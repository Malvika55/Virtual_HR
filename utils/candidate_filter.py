from pathlib import Path
import pandas as pd

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "candidates.csv"


def load_candidates() -> pd.DataFrame:
    return pd.read_csv(DATA_FILE)


def save_candidates(frame: pd.DataFrame) -> None:
    frame.to_csv(DATA_FILE, index=False)


def shortlist_candidates(min_ats=75, min_interview=70) -> pd.DataFrame:
    frame = load_candidates()
    return frame[(frame["ats_score"] >= min_ats) & (frame["interview_score"] >= min_interview)]
