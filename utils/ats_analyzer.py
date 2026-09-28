import re
from .resume_parser import clean_text

# Comprehensive skill dictionary categorized by domain
TECHNICAL_SKILLS_CATALOG = {
    # Programming Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "golang", "ruby", "php", "swift", "kotlin", "rust", "sql", "bash", "r",
    # Frontend
    "html", "css", "html5", "css3", "react", "react.js", "vue", "vue.js", "angular", "next.js", "tailwind", "bootstrap", "sass", "redux", "webpack", "vite", "responsive design",
    # Backend & Frameworks
    "flask", "django", "fastapi", "node.js", "express", "express.js", "spring boot", "asp.net", "rest api", "graphql", "grpc", "microservices", "sqlalchemy",
    # Databases & Caching
    "mysql", "postgresql", "sqlite", "mongodb", "redis", "elasticsearch", "cassandra", "dynamodb", "database design", "indexing",
    # Cloud & DevOps
    "docker", "kubernetes", "aws", "azure", "gcp", "ci/cd", "github actions", "jenkins", "terraform", "linux", "nginx", "prometheus", "grafana", "git", "gitlab",
    # Data & Analytics
    "pandas", "numpy", "matplotlib", "seaborn", "tableau", "power bi", "excel", "etl", "machine learning", "data analysis", "data cleaning", "scikit-learn",
    # QA & Testing
    "unit testing", "pytest", "unittest", "selenium", "cypress", "postman", "jest", "automation testing", "tdd", "bdd",
    # Soft & Professional Skills
    "agile", "scrum", "leadership", "problem solving", "communication", "team collaboration", "project management", "system design"
}

SECTION_HEADERS = {
    "summary": ["summary", "profile", "about me", "objective", "professional summary", "career objective"],
    "experience": ["experience", "work experience", "employment", "professional experience", "work history", "internship"],
    "education": ["education", "academic background", "qualifications", "academics", "degrees"],
    "skills": ["skills", "technical skills", "core competencies", "technologies", "tools & technologies"],
    "projects": ["projects", "personal projects", "academic projects", "key projects"],
}


def extract_skills_from_text(text: str) -> list[str]:
    source = " " + clean_text(text) + " "
    found = []
    for skill in sorted(TECHNICAL_SKILLS_CATALOG, key=len, reverse=True):
        pattern = r"(?<![\w#+.-])" + re.escape(skill) + r"(?![\w#+.-])"
        if re.search(pattern, source, re.IGNORECASE):
            found.append(skill)
    return sorted(list(dict.fromkeys(found)))


def detect_sections(text: str) -> dict:
    lowered = text.lower()
    detected = {}
    for section, synonyms in SECTION_HEADERS.items():
        found = any(re.search(r"\b" + re.escape(syn) + r"\b", lowered) for syn in synonyms)
        detected[section] = found
    return detected


def detect_metrics_and_impact(text: str) -> list[str]:
    # Look for quantifiable achievement patterns (%, numbers, currency, scale)
    patterns = [
        r"\b\d+%\b",
        r"\$\d+(?:,\d+)*(?:\.\d+)?\b",
        r"\b(?:reduced|increased|improved|scaled|boosted|optimized|accelerated|automated)\s+[^\.\n]{5,60}\b",
        r"\b\d+\+?\s*(?:users|clients|requests|transactions|ms|seconds|minutes|hours)\b"
    ]
    impact_items = []
    for p in patterns:
        matches = re.findall(p, text, flags=re.IGNORECASE)
        impact_items.extend(matches)
    return impact_items[:6]


def parse_job_requirements(job: dict | str) -> tuple[list[str], str, str, str]:
    if isinstance(job, dict):
        raw_req = str(job.get("requirements", "")).replace(";", ",")
        skills = [item.strip().lower() for item in re.split(r",|\s+(?=[A-Z][a-z]+\s|REST\s|SQL\b|API\b|Git\b|AWS\b|HTML\b|CSS\b|Flask\b|Docker\b|Linux\b|Pandas\b|Excel\b|React\b|Java\b)", raw_req) if item.strip()]
        if not skills:
            skills = [item.strip().lower() for item in str(job.get("required_skills", "")).replace(";", ",").split(",") if item.strip()]
        description = str(job.get("description", "")) + " " + raw_req
        min_exp = str(job.get("minimum_experience", ""))
        edu = str(job.get("education", ""))
        return skills, description, min_exp, edu
    else:
        desc = str(job or "")
        skills = extract_skills_from_text(desc)
        return skills, desc, "", ""


def analyze_resume(text: str, job: dict | str = "") -> dict:
    source_clean = clean_text(text)
    words = source_clean.split()
    word_count = len(words)

    required_skills, description, min_exp, edu = parse_job_requirements(job)
    if not required_skills:
        required_skills = ["python", "sql", "git", "rest api", "html", "css", "javascript"]

    # Normalize required skills
    normalized_required = list(dict.fromkeys([s.lower().strip() for s in required_skills if s.strip()]))

    # Skills found
    extracted_resume_skills = extract_skills_from_text(text)
    matched_skills = [s for s in normalized_required if s in extracted_resume_skills or re.search(r"\b" + re.escape(s) + r"\b", source_clean)]
    missing_skills = [s for s in normalized_required if s not in matched_skills]

    # Additional job description keyword match
    desc_skills = extract_skills_from_text(description)
    all_target_keywords = list(dict.fromkeys(normalized_required + desc_skills))
    matched_keywords = [k for k in all_target_keywords if k in extracted_resume_skills or re.search(r"\b" + re.escape(k) + r"\b", source_clean)]
    missing_keywords = [k for k in all_target_keywords if k not in matched_keywords]

    # Section detection
    sections = detect_sections(text)
    detected_section_count = sum(1 for present in sections.values() if present)

    # Metrics & quantification
    impact_matches = detect_metrics_and_impact(text)

    # 1. Skills match score (max 35 pts)
    skill_coverage = len(matched_skills) / max(len(normalized_required), 1)
    skills_score = round(min(skill_coverage * 35, 35))

    # 2. Keyword match score (max 25 pts)
    keyword_coverage = len(matched_keywords) / max(len(all_target_keywords), 1)
    keyword_score = round(min(keyword_coverage * 25, 25))

    # 3. Experience & impact score (max 20 pts)
    has_years = bool(re.search(r"\b[1-9]\d?\+?\s*(?:years?|yrs?)\b", source_clean))
    has_metrics = len(impact_matches) >= 2
    exp_score = 0
    if has_years: exp_score += 10
    if has_metrics: exp_score += 8
    elif len(impact_matches) == 1: exp_score += 4
    if word_count >= 180: exp_score += 2
    experience_score = min(exp_score, 20)

    # 4. Education score (max 10 pts)
    has_degree = bool(re.search(r"\b(?:bachelor|master|b\.?tech|b\.?e\.?|m\.?tech|bca|mca|bs|ms|phd|diploma|degree|university|institute|college)\b", source_clean))
    education_score = 10 if has_degree else 4

    # 5. ATS formatting & completeness score (max 10 pts)
    format_score = min(round((detected_section_count / 5) * 6 + (4 if 150 <= word_count <= 850 else 2)), 10)

    # Total score
    total_score = min(skills_score + keyword_score + experience_score + education_score + format_score, 100)

    # Grade
    if total_score >= 85:
        rating = "ATS Ready · Excellent Fit"
        badge_class = "success"
    elif total_score >= 70:
        rating = "Good Fit · Minor Gaps"
        badge_class = "primary"
    elif total_score >= 50:
        rating = "Moderate Match · Needs Optimization"
        badge_class = "warning"
    else:
        rating = "Low Match · Substantial Gaps"
        badge_class = "danger"

    # Actionable Suggestions
    suggestions = []
    if missing_skills:
        top_missing = ", ".join(f"'{s}'" for s in missing_skills[:4])
        suggestions.append(f"Add required technical skills: {top_missing} if you have practical experience with them.")
    if not has_metrics:
        suggestions.append("Quantify your achievements using measurable metrics (e.g. 'Improved query performance by 35%', 'Scaled service to 10k users').")
    if not sections.get("summary"):
        suggestions.append("Include a concise Professional Summary at the top to give recruiters an instant executive pitch.")
    if not sections.get("projects"):
        suggestions.append("Add a dedicated Projects section highlighting technologies used, architecture, and live repository links.")
    if word_count < 180:
        suggestions.append("Expand on your work responsibilities and bullet points (recommended 250-600 words for an ATS resume).")
    if len(suggestions) < 3:
        suggestions.append("Use standard bullet points with strong action verbs (Architected, Engineered, Optimized, Delivered).")

    return {
        "score": total_score,
        "rating": rating,
        "badge_class": badge_class,
        "word_count": word_count,
        "breakdown": {
            "skills_match": skills_score,
            "keyword_match": keyword_score,
            "experience_match": experience_score,
            "education_match": education_score,
            "formatting_and_sections": format_score,
        },
        "sections_detected": sections,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "all_extracted_skills": extracted_resume_skills,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "impact_statements": impact_matches,
        "suggestions": suggestions[:5],
    }
