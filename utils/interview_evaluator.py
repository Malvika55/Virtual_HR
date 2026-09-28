import re

CONCEPTS = {
    "where": ["filter", "rows", "before", "group", "aggregate"],
    "rest": ["http", "api", "stateless", "get", "post", "put", "delete", "status"],
    "python": ["interpreted", "dynamic", "object", "library", "indentation"],
}


def calculate_score(answer: str, concepts: list[str]) -> int:
    words = answer.lower().split()
    coverage = sum(1 for concept in concepts if concept in answer.lower()) / max(len(concepts), 1)
    length_score = min(len(words) / 35, 1)
    return round(coverage * 75 + length_score * 25)


def find_missing_concepts(answer: str, concepts: list[str]) -> list[str]:
    return [concept for concept in concepts if concept not in answer.lower()]


def generate_feedback(score: int, missing: list[str]) -> str:
    if score >= 80:
        return "Strong response with good technical depth. Add a concrete production trade-off to make it outstanding."
    if score >= 60:
        return "Good foundational understanding. Expand with specific architectural details and real project examples."
    return "The response needs more technical structure. State the definition, explain the mechanism, and provide an example."


def evaluate_answer(answer: str, question: str) -> dict:
    lowered_question = question.lower()
    key = "rest" if "rest" in lowered_question else "where" if "where" in lowered_question else "python"
    concepts = CONCEPTS[key]
    score = calculate_score(answer, concepts)
    missing = find_missing_concepts(answer, concepts)
    return {
        "score": score,
        "feedback": generate_feedback(score, missing),
        "missing_concepts": missing,
        "suggestions": [
            "Structure response clearly: Definition -> Mechanism -> Practical Example -> Trade-off.",
            "Incorporate standard industry terminology where applicable.",
        ],
    }


def evaluate_question(answer: str, question: dict) -> dict:
    answer_clean = (answer or "").strip()
    words = answer_clean.split()
    word_count = len(words)

    if not answer_clean:
        return {
            "score": 0,
            "technical_score": 0,
            "communication_score": 0,
            "grade": "Unanswered",
            "feedback": "No answer was provided for this question.",
            "matched_concepts": [],
            "missing_concepts": [item.strip() for item in str(question.get("expected_keywords", "")).split("|") if item.strip()][:5],
            "word_count": 0,
            "suggestions": ["Answer the question directly and outline your thought process."],
        }

    keywords = [item.strip().lower() for item in str(question.get("expected_keywords", "")).split("|") if item.strip()]
    concepts = [item.strip().lower() for item in str(question.get("expected_concepts", "")).split("|") if item.strip()]
    source = answer_clean.lower()

    # Match keywords and multi-word concepts with flexible sub-string/word boundary checking
    keyword_hits = []
    for item in keywords:
        pattern = r"\b" + re.escape(item) + r"\b" if " " not in item else re.escape(item)
        if re.search(pattern, source):
            keyword_hits.append(item)

    concept_hits = []
    for item in concepts:
        pattern = r"\b" + re.escape(item) + r"\b" if " " not in item else re.escape(item)
        if re.search(pattern, source):
            concept_hits.append(item)

    # Technical accuracy (0 - 55 pts)
    kw_ratio = len(keyword_hits) / max(len(keywords), 1)
    cp_ratio = len(concept_hits) / max(len(concepts), 1)
    technical_score = round(kw_ratio * 30 + cp_ratio * 25)

    # Communication & Structure (0 - 25 pts)
    # Rewards concise yet comprehensive answers (35 to 150 words ideal for virtual interview speaking/typing)
    if word_count >= 50:
        length_points = 20
    elif word_count >= 25:
        length_points = 15
    elif word_count >= 12:
        length_points = 10
    else:
        length_points = 5

    # Check for structured keywords like "for example", "because", "such as", "however", "first", "second"
    has_structure = any(marker in source for marker in ["for example", "such as", "because", "however", "first", "second", "in contrast", "trade-off", "situation", "result"])
    structure_bonus = 5 if has_structure else 0
    communication_score = min(length_points + structure_bonus, 25)

    # Domain Relevance (0 - 20 pts)
    relevance_score = 20 if (len(keyword_hits) + len(concept_hits)) >= 3 else 12 if (len(keyword_hits) + len(concept_hits)) >= 1 else 5

    total_score = min(round(technical_score + communication_score + relevance_score), 100)

    # Missing concepts
    missing_kw = [k for k in keywords if k not in keyword_hits]
    missing_cp = [c for c in concepts if c not in concept_hits]
    all_missing = list(dict.fromkeys(missing_kw + missing_cp))

    # Grade & feedback
    if total_score >= 85:
        grade = "Exceptional"
        feedback = "Outstanding response! Comprehensive domain coverage, structured explanation, and clear terminology."
    elif total_score >= 70:
        grade = "Strong Hire"
        feedback = "Great answer with solid technical grasp. Consider adding a specific edge case or production trade-off."
    elif total_score >= 50:
        grade = "Competent"
        feedback = "Satisfactory starting point. Elaborate further on underlying mechanics and include a concrete practical example."
    else:
        grade = "Needs Practice"
        feedback = "Response lacked core technical depth and expected keywords. Define the concept clearly and explain its practical execution."

    suggestions = []
    if missing_kw:
        suggestions.append(f"Consider referencing key terms: {', '.join(missing_kw[:3])}.")
    if not has_structure:
        suggestions.append("Structure your thoughts using the STAR framework or Problem -> Solution -> Trade-off flow.")
    if word_count < 30:
        suggestions.append("Provide a more detailed explanation with at least one concrete real-world use case.")

    return {
        "score": total_score,
        "technical_score": technical_score,
        "communication_score": communication_score,
        "grade": grade,
        "feedback": feedback,
        "matched_concepts": list(dict.fromkeys(keyword_hits + concept_hits)),
        "missing_concepts": all_missing[:6],
        "word_count": word_count,
        "suggestions": suggestions,
    }
