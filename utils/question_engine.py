from pathlib import Path
import random
import pandas as pd

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "questions.csv"

ROLE_ALIASES = {
    "python developer": ["python developer", "software engineer", "general"],
    "full stack engineer": ["full stack engineer", "full stack developer", "software engineer", "general"],
    "full stack developer": ["full stack engineer", "full stack developer", "software engineer", "general"],
    "data analyst": ["data analyst", "general"],
    "qa engineer": ["qa engineer", "software engineer", "general"],
    "devops engineer": ["devops engineer", "software engineer", "general"],
    "software engineer": ["software engineer", "general"],
}


def load_questions() -> pd.DataFrame:
    frame = pd.read_csv(DATA_FILE).fillna("")
    for column in ("expected_keywords", "expected_concepts", "weight", "difficulty", "job_role", "category"):
        if column not in frame:
            frame[column] = "" if column != "weight" else 8
    frame["weight"] = pd.to_numeric(frame["weight"], errors="coerce").fillna(8).astype(int)
    return frame


def select_questions(job_role: str, count: int = 5, difficulty: str = "") -> list[dict]:
    frame = load_questions()
    if frame.empty:
        return []

    role_key = job_role.strip().lower()
    allowed_roles = ROLE_ALIASES.get(role_key, [role_key, "general", "software engineer"])

    # Match primary role questions and general questions
    primary_pool = frame[frame["job_role"].str.lower() == role_key]
    if primary_pool.empty:
        # Fallback to alias matching
        primary_pool = frame[frame["job_role"].str.lower().isin(allowed_roles)]

    behavioral_pool = frame[frame["job_role"].str.lower() == "general"]

    # Filter by difficulty if requested
    diff = difficulty.strip().lower()
    if diff in {"easy", "medium", "hard"}:
        filtered_primary = primary_pool[primary_pool["difficulty"].str.lower() == diff]
        if not filtered_primary.empty:
            primary_pool = filtered_primary
        filtered_behavioral = behavioral_pool[behavioral_pool["difficulty"].str.lower() == diff]
        if not filtered_behavioral.empty:
            behavioral_pool = filtered_behavioral

    # Realistic virtual interview structure:
    # If count >= 4, reserve 1 slot for a behavioral/HR question to simulate a real interview!
    include_behavioral = count >= 4 and not behavioral_pool.empty
    technical_target = count - 1 if include_behavioral else count

    selected = []

    # Pick unique categories from primary pool
    categories = primary_pool["category"].unique()
    random.seed(abs(hash(job_role + str(count) + difficulty)) % (2**32 - 1))
    shuffled_categories = list(categories)
    random.shuffle(shuffled_categories)

    for cat in shuffled_categories:
        cat_group = primary_pool[primary_pool["category"] == cat]
        if not cat_group.empty and len(selected) < technical_target:
            sample_row = cat_group.sample(1, random_state=random.randint(1, 10000)).iloc[0]
            selected.append(sample_row)

    # If still need more technical questions, sample from remaining
    chosen_ids = {row["id"] for row in selected}
    remaining_technical = primary_pool[~primary_pool["id"].isin(chosen_ids)]
    if len(selected) < technical_target and not remaining_technical.empty:
        needed = technical_target - len(selected)
        additional = remaining_technical.sample(min(needed, len(remaining_technical)), random_state=42)
        for _, row in additional.iterrows():
            selected.append(row)

    # Add behavioral/HR question if enabled
    if include_behavioral and not behavioral_pool.empty:
        behavioral_sample = behavioral_pool.sample(1, random_state=random.randint(1, 10000)).iloc[0]
        selected.append(behavioral_sample)

    # If still below target count, backfill from entire question bank
    if len(selected) < count:
        chosen_ids = {row["id"] for row in selected}
        backfill_pool = frame[~frame["id"].isin(chosen_ids)]
        if not backfill_pool.empty:
            needed = count - len(selected)
            fill_rows = backfill_pool.sample(min(needed, len(backfill_pool)), random_state=7)
            for _, row in fill_rows.iterrows():
                selected.append(row)

    results = pd.DataFrame(selected).head(count).to_dict("records")
    return results
