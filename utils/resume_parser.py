import re
from pathlib import Path
from PyPDF2 import PdfReader


def extract_text_from_pdf(file_path: str | Path) -> str:
    reader = PdfReader(str(file_path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w+.#-]", " ", text.lower())).strip()
