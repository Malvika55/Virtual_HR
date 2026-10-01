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
    for column, default in {"ats_score": 0, "screening_score": 0, "interview_score": 0, "status": "New"}.items():
        if column not in frame:
            frame[column] = default
    return frame


def save_candidates(frame: pd.DataFrame) -> None:
    frame.to_csv(DATA_FILE, index=False)


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
