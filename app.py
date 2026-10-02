from pathlib import Path
import json
import os
import re
import shutil
import pandas as pd
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, send_file, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from utils.ats_analyzer import analyze_resume
from utils.candidate_manager import ensure_candidate_profile, load_candidates, save_candidates, record_interview_score, update_candidate
from utils.email_service import send_email
from utils.interview_evaluator import evaluate_answer, evaluate_question
from utils.question_engine import load_questions, select_questions
from utils.resume_parser import extract_text_from_pdf

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RUNTIME_DIR = Path(os.getenv("VERCEL_RUNTIME_DIR", "/tmp/virtual-hr" if os.getenv("VERCEL") else str(BASE_DIR)))
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR = RUNTIME_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
JOBS_FILE = RUNTIME_DIR / "jobs.csv"
if not JOBS_FILE.exists():
    shutil.copyfile(DATA_DIR / "jobs.csv", JOBS_FILE)
load_dotenv(BASE_DIR / ".env")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY") or "local-demo-secret"
ALLOWED_EXTENSIONS = {"pdf"}
RESULTS_FILE = RUNTIME_DIR / "interview_results.csv"
ATS_RESULTS_FILE = RUNTIME_DIR / "ats_results.csv"
USERS_FILE = RUNTIME_DIR / "users.json"


def load_users():
    if not USERS_FILE.exists():
        users = [
            {
                "email": "hr.manager@virtualhr.local",
                "name": "HR Manager",
                "role": "hr",
                "password": generate_password_hash("demo123"),
            },
            {
                "email": "candidate@virtualhr.local",
                "name": "Candidate",
                "role": "candidate",
                "password": generate_password_hash("candidate123"),
            },
        ]
        USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []


def save_users(users):
    USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")


def load_jobs():
    return pd.read_csv(JOBS_FILE).fillna("")


def get_job(job_id):
    jobs = load_jobs()
    match = jobs[jobs["id"].astype(str) == str(job_id)]
    return match.iloc[0].to_dict() if not match.empty else None


def page_context(active="dashboard", title="Dashboard"):
    candidates = load_candidates()
    email = session.get("email", "hr.manager@virtualhr.local")
    return {
        "active": active,
        "title": title,
        "candidate_mode": session.get("role") == "candidate",
        "account_email": email,
        "display_name": session.get("display_name", "HR Manager"),
        "candidate_count": len(candidates),
        "new_applications": int((candidates["status"] == "New").sum()),
        "shortlisted_count": int((candidates["status"] == "Shortlisted").sum()),
        "rejected_count": int((candidates["status"] == "Rejected").sum()),
    }


@app.route("/")
def index():
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        mode = request.form.get("mode", "login")
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            return render_template("login.html", error="Enter a valid email address to continue.", mode=mode), 400
        if len(password) < 6:
            return render_template("login.html", error="Password must be at least 6 characters.", mode=mode), 400

        users = load_users()
        user = next((item for item in users if item.get("email") == email), None)
        if mode == "register":
            if user:
                return render_template("login.html", error="An account with this email already exists.", mode=mode), 409
            role = request.form.get("role", "candidate")
            name = request.form.get("name", "").strip() or email.split("@", 1)[0].replace(".", " ").title()
            user = {"email": email, "name": name, "role": role, "password": generate_password_hash(password)}
            users.append(user)
            save_users(users)
        elif not user or not check_password_hash(user.get("password", ""), password):
            return render_template("login.html", error="Email or password is incorrect.", mode=mode), 401

        session["role"] = user["role"]
        session["email"] = email
        session["display_name"] = user.get("name") or email.split("@", 1)[0].replace(".", " ").replace("_", " ").replace("-", " ").title()
        if user["role"] == "candidate":
            candidate_id = ensure_candidate_profile(
                email,
                session["display_name"],
                phone=request.form.get("phone", "").strip(),
                position=request.form.get("position", "").strip(),
                experience=request.form.get("experience", "").strip(),
                location=request.form.get("location", "").strip(),
                skills=request.form.get("skills", "").strip(),
            )
            saved_profile = {key: user[key] for key in ("ats_score", "resume_filename", "position") if key in user}
            if not saved_profile.get("ats_score") and ATS_RESULTS_FILE.exists():
                ats_records = pd.read_csv(ATS_RESULTS_FILE).fillna("")
                matches = ats_records[ats_records["candidate_id"].astype(str).str.lower() == email]
                if not matches.empty:
                    latest = matches.iloc[-1]
                    saved_profile["ats_score"] = int(latest.get("ats_score", 0))
                    saved_profile["resume_filename"] = latest.get("resume_filename", "")
            if saved_profile:
                update_candidate(candidate_id, **saved_profile)
                user.update(saved_profile)
                save_users(users)
        return redirect(url_for("dashboard" if user["role"] == "hr" else "candidate_dashboard"))
    mode = request.args.get("mode", "login")
    return render_template("login.html", mode=mode if mode in {"login", "register"} else "login")


@app.route("/dashboard")
def dashboard():
    candidates = load_candidates()
    recent = candidates.head(6).to_dict("records")
    context = page_context()
    context.update({"recent_candidates": recent, "interviews": [
        {"candidate": "Aarav Mehta", "position": "Python Developer", "date": "24 Sep 2026", "time": "10:30 AM", "type": "Technical", "status": "Confirmed"},
        {"candidate": "Nisha Kapoor", "position": "Full Stack Engineer", "date": "25 Sep 2026", "time": "02:00 PM", "type": "Panel", "status": "Pending"},
        {"candidate": "Rohan Shah", "position": "Data Analyst", "date": "27 Sep 2026", "time": "11:00 AM", "type": "Screening", "status": "Confirmed"},
    ]})
    return render_template("dashboard.html", **context)


@app.route("/candidate-dashboard")
def candidate_dashboard():
    context = page_context("candidate-dashboard", "Candidate Dashboard")
    candidates = load_candidates()
    candidate = candidates[candidates["email"].astype(str).str.lower() == session.get("email", "").lower()]
    profile = candidate.iloc[0] if not candidate.empty else None
    context.update({
        "candidate_name": context["display_name"],
        "ats_score": int(profile["ats_score"]) if profile is not None else 0,
        "interview_score": int(profile["interview_score"]) if profile is not None else 0,
    })
    return render_template("candidate-dashboard.html", **context)


@app.route("/application-status")
def application_status():
    if session.get("role") != "candidate":
        return redirect(url_for("dashboard"))
    candidates = load_candidates()
    match = candidates[candidates["email"].astype(str).str.lower() == session.get("email", "").lower()]
    candidate = match.iloc[0].to_dict() if not match.empty else None
    return render_template("application-status.html", **page_context("application-status", "Application Status"), candidate=candidate)


@app.route("/candidates")
def candidates():
    frame = load_candidates()
    query = request.args.get("q", "").strip().lower()
    status = request.args.get("status", "").strip()
    position = request.args.get("position", "").strip()
    if query:
        frame = frame[frame.apply(lambda row: query in " ".join(map(str, row.values)).lower(), axis=1)]
    if status == "Not shortlisted":
        frame = frame[frame["status"] != "Shortlisted"]
    elif status:
        frame = frame[frame["status"] == status]
    if position:
        frame = frame[frame["position"] == position]
    context = page_context("candidates", "Candidate Management")
    context.update({"candidates": frame.to_dict("records"), "positions": sorted(load_candidates()["position"].unique()), "selected_status": status, "selected_position": position, "query": query})
    return render_template("candidates.html", **context)


@app.route("/candidate/<candidate_id>")
def candidate_detail(candidate_id):
    frame = load_candidates()
    record = frame[frame["id"].astype(str) == str(candidate_id)]
    if record.empty:
        return redirect(url_for("candidates"))
    candidate = record.iloc[0].to_dict()
    email = str(candidate.get("email", "")).lower()
    ats_records = pd.read_csv(ATS_RESULTS_FILE).fillna("") if ATS_RESULTS_FILE.exists() else pd.DataFrame()
    if not ats_records.empty and "candidate_id" in ats_records:
        ats_records = ats_records[
            (ats_records["candidate_id"].astype(str).str.lower() == email)
            | (ats_records["candidate_id"].astype(str) == str(candidate_id))
        ]
    latest_ats = ats_records.iloc[-1].to_dict() if not ats_records.empty else None
    if latest_ats:
        if candidate.get("resume_filename"):
            latest_ats["resume_filename"] = candidate["resume_filename"]
        resume_name = secure_filename(str(latest_ats.get("resume_filename", "")))
        latest_ats["resume_available"] = bool(resume_name and (UPLOAD_DIR / resume_name).is_file())
    elif candidate.get("resume_filename"):
        resume_name = secure_filename(str(candidate["resume_filename"]))
        latest_ats = {
            "resume_filename": candidate["resume_filename"],
            "resume_available": bool(resume_name and (UPLOAD_DIR / resume_name).is_file()),
        }
    interview_records = pd.read_csv(RESULTS_FILE).fillna("") if RESULTS_FILE.exists() else pd.DataFrame()
    if not interview_records.empty and "candidate_id" in interview_records:
        interview_records = interview_records[
            (interview_records["candidate_id"].astype(str).str.lower() == email)
            | (interview_records["candidate_id"].astype(str) == str(candidate_id))
        ]
    applied_role = candidate.get("position", "")
    if latest_ats and latest_ats.get("job_id"):
        job = get_job(latest_ats["job_id"])
        if job:
            applied_role = job.get("title", applied_role)
    return render_template(
        "candidate-details.html",
        **page_context("candidates", "Candidate Profile"),
        candidate=candidate,
        applied_role=applied_role,
        latest_ats=latest_ats,
        interview_records=interview_records.to_dict("records"),
    )


@app.route("/uploads/<path:filename>")
def uploaded_resume(filename):
    safe_name = secure_filename(filename)
    path = UPLOAD_DIR / safe_name
    if not path.is_file():
        return redirect(url_for("resume_analyzer"))
    return send_file(path, as_attachment=False, download_name=safe_name)


@app.route("/candidate/<candidate_id>/status", methods=["POST"])
def update_candidate_status(candidate_id):
    frame = load_candidates()
    if candidate_id in frame["id"].astype(str).tolist():
        frame.loc[frame["id"].astype(str) == str(candidate_id), "status"] = request.json.get("status", "On Hold")
        save_candidates(frame)
    return jsonify({"ok": True})


@app.route("/resume-analyzer")
def resume_analyzer():
    return render_template("resume-analyzer.html", **page_context("resume-analyzer", "Resume & ATS Analyzer"), jobs=load_jobs().to_dict("records"))


@app.route("/analyze-resume", methods=["POST"])
def analyze_resume_route():
    resume = request.files.get("resume")
    resume_text = request.form.get("resume_text", "").strip()
    filename = "pasted-resume-text.txt"

    if resume and resume.filename:
        if not resume.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Please upload a valid PDF resume or paste resume text."}), 400
        filename = secure_filename(resume.filename)
        destination = UPLOAD_DIR / filename
        resume.save(destination)
        try:
            text = extract_text_from_pdf(destination)
        except Exception as error:
            destination.unlink(missing_ok=True)
            return jsonify({"error": f"This PDF could not be read: {error}. Please ensure it is a text-based PDF or paste text directly."}), 400
    elif resume_text:
        text = resume_text
    else:
        return jsonify({"error": "Please either upload a PDF resume or paste your resume text to analyze."}), 400

    if not text.strip():
        return jsonify({"error": "No readable text was found. Please upload a text-based resume or paste text directly."}), 400

    job_id = request.form.get("job_id", "")
    job = get_job(job_id) if job_id else request.form.get("job_description", "")
    result = analyze_resume(text, job)
    result["filename"] = filename
    result["job_id"] = job_id
    result["analysis_date"] = pd.Timestamp.now().strftime("%Y-%m-%d")

    candidate_id = request.form.get("candidate_id") or session.get("email", "candidate@virtualhr.local")
    breakdown = result["breakdown"]
    record = {
        "result_id": pd.Timestamp.now().strftime("%Y%m%d%H%M%S%f"),
        "candidate_id": candidate_id,
        "job_id": result["job_id"],
        "resume_filename": filename,
        "ats_score": result["score"],
        "skills_score": breakdown.get("skills_match", 0),
        "keyword_score": breakdown.get("keyword_match", 0),
        "experience_score": breakdown.get("experience_match", 0),
        "education_score": breakdown.get("education_match", 0),
        "relevance_score": breakdown.get("formatting_and_sections", 0),
        "matched_skills": "|".join(result["matched_skills"]),
        "missing_skills": "|".join(result["missing_skills"]),
        "suggestions": "|".join(result["suggestions"]),
        "analysis_date": result["analysis_date"],
    }
    pd.DataFrame([record]).to_csv(ATS_RESULTS_FILE, mode="a", header=not ATS_RESULTS_FILE.exists(), index=False)

    update_values = {"ats_score": result["score"]}
    if job and isinstance(job, dict):
        update_values["position"] = job.get("title", "")
    update_values["resume_filename"] = filename
    update_candidate(candidate_id, **update_values)
    users = load_users()
    for user in users:
        if user.get("email", "").lower() == str(candidate_id).lower() or user.get("email", "").lower() == str(session.get("email", "")).lower():
            user.update({"ats_score": result["score"], "resume_filename": filename})
            if job and isinstance(job, dict):
                user["position"] = job.get("title", "")
            save_users(users)
            break

    return jsonify(result)


@app.route("/screening")
def screening():
    return render_template("screening.html", **page_context("screening", "HR Screening"), candidates=load_candidates().to_dict("records"))


@app.route("/mock-interview")
def mock_interview():
    jobs = load_jobs().to_dict("records")
    selected_job = request.args.get("job_id", "")
    difficulty = request.args.get("difficulty", "").strip()
    count_param = request.args.get("count", "5").strip()
    try:
        count = max(1, min(int(count_param), 15))
    except ValueError:
        count = 5
    job = get_job(selected_job) if selected_job else (jobs[0] if jobs else {})
    questions = select_questions(job.get("title", "General"), count=count, difficulty=difficulty) if job else []
    return render_template(
        "mock-interview.html",
        **page_context("mock-interview", "Virtual Mock Interview Studio"),
        questions=questions,
        jobs=jobs,
        selected_job=job,
        selected_difficulty=difficulty,
        selected_count=count,
    )


@app.route("/open-roles")
def open_roles():
    if session.get("role") != "candidate":
        return redirect(url_for("dashboard"))
    email = session.get("email", "").lower()
    candidates = load_candidates()
    match = candidates[candidates["email"].astype(str).str.lower() == email]
    candidate = match.iloc[0].to_dict() if not match.empty else {"name": session.get("display_name", ""), "email": email}
    return render_template("open-roles.html", **page_context("open-roles", "Open Roles"), jobs=load_jobs().to_dict("records"), candidate=candidate)


@app.route("/apply/<job_id>", methods=["POST"])
def apply_for_role(job_id):
    if session.get("role") != "candidate":
        return redirect(url_for("login"))
    job = get_job(job_id)
    if not job:
        return redirect(url_for("open_roles"))
    email = session.get("email", "").lower()
    candidate_id = ensure_candidate_profile(email, session.get("display_name", "Candidate"))
    values = {
        "name": request.form.get("name", "").strip(),
        "phone": request.form.get("phone", "").strip(),
        "experience": request.form.get("experience", "").strip(),
        "location": request.form.get("location", "").strip(),
        "skills": request.form.get("skills", "").strip(),
        "position": job["title"],
        "status": "New",
        "ats_score": 0,
        "screening_score": 0,
        "interview_score": 0,
        "application_date": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "interview_date": "",
        "interview_time": "",
        "interview_type": "",
    }
    resume = request.files.get("resume")
    if resume and resume.filename:
        if not resume.filename.lower().endswith(".pdf"):
            return redirect(url_for("open_roles"))
        filename = secure_filename(f"{candidate_id}_{resume.filename}")
        resume.save(UPLOAD_DIR / filename)
        values["resume_filename"] = filename
    update_candidate(email, **values)
    return redirect(url_for("mock_interview", job_id=job_id))


@app.route("/candidate/<candidate_id>/interview", methods=["POST"])
def schedule_candidate_interview(candidate_id):
    values = {
        "status": "Interview Scheduled",
        "interview_date": request.form.get("interview_date", "").strip(),
        "interview_time": request.form.get("interview_time", "").strip(),
        "interview_type": request.form.get("interview_type", "Technical"),
        "hr_notes": request.form.get("hr_notes", "").strip(),
    }
    update_candidate(candidate_id, **values)
    return redirect(url_for("candidate_detail", candidate_id=candidate_id))


@app.route("/evaluate-interview", methods=["POST"])
def evaluate_interview():
    payload = request.get_json(silent=True) or {}
    question = payload.get("question", {})
    if isinstance(question, str):
        return jsonify(evaluate_answer(payload.get("answer", ""), question))
    result = evaluate_question(payload.get("answer", ""), question)
    result["question_id"] = question.get("id")
    return jsonify(result)


@app.route("/complete-interview", methods=["POST"])
def complete_interview():
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers", [])
    if not answers:
        return jsonify({"error": "Submit at least one answer."}), 400
    evaluations = []
    for item in answers:
        question = item.get("question", {})
        user_answer = item.get("answer", "")
        evaluation = evaluate_question(user_answer, question)
        evaluations.append({**evaluation, "question": question, "user_answer": user_answer})

    score = round(sum(item["score"] for item in evaluations) / len(evaluations)) if evaluations else 0
    technical_avg = round(sum(item.get("technical_score", 0) for item in evaluations) / len(evaluations)) if evaluations else 0
    communication_avg = round(sum(item.get("communication_score", 0) for item in evaluations) / len(evaluations)) if evaluations else 0

    if score >= 85:
        overall_grade = "Exceptional"
    elif score >= 70:
        overall_grade = "Strong Hire"
    elif score >= 50:
        overall_grade = "Competent"
    else:
        overall_grade = "Needs Practice"

    candidate_identifier = payload.get("candidate_id") or session.get("email", "candidate@virtualhr.local")
    result = {
        "score": score,
        "grade": overall_grade,
        "technical_score": technical_avg,
        "communication_score": communication_avg,
        "evaluations": evaluations,
        "job_role": payload.get("job_role", "General"),
        "candidate_id": candidate_identifier,
        "total_questions": len(evaluations),
    }

    records = [
        {
            "result_id": f"{pd.Timestamp.now().strftime('%Y%m%d%H%M%S%f')}-{index}",
            "candidate_id": candidate_identifier,
            "job_role": payload.get("job_role", "General"),
            "question_id": item["question"].get("id", ""),
            "category": item["question"].get("category", ""),
            "answer": item.get("user_answer", ""),
            "score": item["score"],
            "feedback": item["feedback"],
            "date": pd.Timestamp.now().strftime("%Y-%m-%d"),
        }
        for index, item in enumerate(evaluations)
    ]
    pd.DataFrame(records).to_csv(RESULTS_FILE, mode="a", header=not RESULTS_FILE.exists(), index=False)

    record_interview_score(candidate_identifier, score)
    if payload.get("job_role"):
        update_candidate(candidate_identifier, position=payload["job_role"])

    return jsonify(result)


@app.route("/interview-results")
def interview_results():
    results = pd.read_csv(RESULTS_FILE).fillna("").to_dict("records") if RESULTS_FILE.exists() else []
    return render_template("evaluation.html", **page_context("interview-results", "Interview Results"), results=results, completed=True)


@app.route("/ats-results")
def ats_results():
    records = pd.read_csv(ATS_RESULTS_FILE).fillna("").to_dict("records") if ATS_RESULTS_FILE.exists() else []
    return render_template("ats-results.html", **page_context("ats-results", "ATS Results"), results=records)


@app.route("/job-roles", methods=["GET", "POST"])
def job_roles():
    jobs = load_jobs()
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        if title:
            row = {"id": int(jobs["id"].max()) + 1 if not jobs.empty else 1, "title": title, "department": request.form.get("department", "Engineering"), "location": request.form.get("location", "Remote"), "requirements": request.form.get("requirements", "")}
            jobs = pd.concat([jobs, pd.DataFrame([row])], ignore_index=True)
            jobs.to_csv(JOBS_FILE, index=False)
        return redirect(url_for("job_roles"))
    return render_template("jobs.html", **page_context("jobs", "Job Roles"), jobs=jobs.to_dict("records"))


@app.route("/evaluation")
def evaluation():
    return render_template("evaluation.html", **page_context("evaluation", "Interview Evaluation"), completed=False)


@app.route("/resume-builder")
def resume_builder():
    if session.get("role") != "candidate":
        return redirect(url_for("dashboard"))
    return render_template("resume-builder.html", **page_context("resume-builder", "Resume Builder"))


@app.route("/shortlist")
def shortlist():
    frame = load_candidates()
    min_ats = int(request.args.get("min_ats", 0) or 0)
    min_interview = int(request.args.get("min_interview", 0) or 0)
    filtered = frame[(frame["ats_score"] >= min_ats) & (frame["interview_score"] >= min_interview)]
    return render_template("shortlist.html", **page_context("shortlist", "Candidate Shortlisting"), candidates=filtered.to_dict("records"), min_ats=min_ats, min_interview=min_interview)


@app.route("/career-suggestions")
def career_suggestions():
    if session.get("role") != "candidate":
        return redirect(url_for("dashboard"))
    return render_template("career.html", **page_context("career", "Career & Course Suggestions"))


@app.route("/email", methods=["GET", "POST"])
def email_page():
    if session.get("role") == "candidate":
        return redirect(url_for("candidate_dashboard"))
    sent = False
    email_error = None
    if request.method == "POST":
        try:
            sent = send_email(request.form.get("recipient", ""), request.form.get("subject", ""), request.form.get("message", ""))
        except (OSError, ValueError) as error:
            email_error = str(error)
    return render_template(
        "email.html",
        **page_context("email", "Email Communication"),
        sent=sent,
        email_error=email_error,
        recipient=request.args.get("recipient", request.form.get("recipient", "")),
        subject=request.args.get("subject", request.form.get("subject", "")),
        message=request.args.get("message", request.form.get("message", "")),
    )


@app.route("/reports")
def reports():
    frame = load_candidates()
    applications = len(frame)
    screened = int((frame["screening_score"] > 0).sum())
    interviewed = int((frame["interview_score"] > 0).sum())
    shortlisted = int((frame["status"] == "Shortlisted").sum())
    selected = int((frame["status"] == "Selected").sum())
    stats = {"applications": applications, "screened": screened, "interviewed": interviewed, "shortlisted": shortlisted, "selected": selected, "rejected": int((frame["status"] == "Rejected").sum()), "avg_ats": round(frame["ats_score"].mean()), "avg_interview": round(frame["interview_score"].mean())}
    stats["funnel"] = [
        {"label": "Applications", "count": applications},
        {"label": "Screened", "count": screened},
        {"label": "Interviewed", "count": interviewed},
        {"label": "Shortlisted", "count": shortlisted},
        {"label": "Selected", "count": selected},
    ]
    for stage in stats["funnel"]:
        stage["percentage"] = round(stage["count"] / applications * 100) if applications else 0
    return render_template("reports.html", **page_context("reports", "Reports & Analytics"), stats=stats)


@app.route("/settings")
def settings():
    return render_template("settings.html", **page_context("settings", "Settings"))


@app.route("/export-candidates")
def export_candidates():
    return send_file(DATA_DIR / "candidates.csv", as_attachment=True, download_name="candidates.csv")


@app.route("/api/candidates")
def api_candidates():
    return jsonify(load_candidates().to_dict("records"))


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
