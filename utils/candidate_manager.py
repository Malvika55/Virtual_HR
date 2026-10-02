from pathlib import Path
from datetime import datetime
import os
import shutil
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
SOURCE_FILE = BASE_DIR / "data" / "candidates.csv"
RUNTIME_DIR = Path(os.getenv("VERCEL_RUNTIME_DIR", "/tmp/virtual-hr" if os.getenv("VERCEL") else str(BASE_DIR)))
DATA_FILE = RUNTIME_DIR / "candidates.csv"
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
if not DATA_FILE.exists():
    shutil.copyfile(SOURCE_FILE, DATA_FILE)


def load_candidates() -> pd.DataFrame:
    frame = pd.read_csv(DATA_FILE).fillna("")
    for column, default in {"ats_score": 0, "screening_score": 0, "interview_score": 0, "status": "New", "resume_filename": "", "application_date": "", "interview_date": "", "interview_time": "", "interview_type": "", "hr_notes": ""}.items():
        if column not in frame:
            frame[column] = default
    return frame


def save_candidates(frame: pd.DataFrame) -> None:
    frame.to_csv(DATA_FILE, index=False)


def ensure_candidate_profile(email: str, name: str, **details) -> str:
    frame = load_candidates()
    email = email.strip().lower()
    existing = frame[frame["email"].astype(str).str.lower() == email]
    if not existing.empty:
        return str(existing.iloc[0]["id"])

    numeric_ids = pd.to_numeric(frame["id"], errors="coerce").dropna()
    candidate_id = str(int(numeric_ids.max()) + 1) if not numeric_ids.empty else "1"
    profile = {
        "id": candidate_id,
        "name": name.strip() or email.split("@", 1)[0].replace(".", " ").title(),
        "email": email,
        "phone": details.get("phone", ""),
        "position": details.get("position", "Open to opportunities"),
        "experience": details.get("experience", "Not provided"),
        "location": details.get("location", "Not provided"),
        "skills": details.get("skills", ""),
        "ats_score": 0,
        "screening_score": 0,
        "interview_score": 0,
        "status": "New",
    }
    frame = pd.concat([frame, pd.DataFrame([profile])], ignore_index=True)
    save_candidates(frame)
    return candidate_id


def update_candidate(candidate_id: str, **values) -> bool:
    frame = load_candidates()
    candidate_str = str(candidate_id).strip().lower()
    mask = (frame["id"].astype(str) == str(candidate_id)) | (frame["email"].astype(str).str.lower() == candidate_str)
    if not mask.any():
        return False
    for key, value in values.items():
        if key in frame.columns:
            frame.loc[mask, key] = value
    save_candidates(frame)
    return True


def record_interview_score(candidate_id: str, score: int) -> bool:
    return update_candidate(candidate_id, interview_score=score, status="Interview", interview_date=datetime.now().strftime("%Y-%m-%d"))
