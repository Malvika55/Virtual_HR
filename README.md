# Virtual HR System

A local Flask application for recruitment operations: candidate management, transparent resume ATS analysis, HR screening, mock interviews, shortlist decisions, resume building, career suggestions, email templates, and reporting.

## Run locally

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`. The login is intentionally simulated for demonstration. Use the HR or Candidate button to enter the corresponding workspace.

## Implementation notes

- Candidate, job, and interview question data live in `data/` CSV files.
- Resume analysis uses PyPDF2, regex, and transparent weighted keyword/formatting rules.
- Interview evaluation uses rule-based concept coverage and answer length checks.
- SMTP email sending is disabled until the server-side values in `.env` are configured.

## Enable Gmail sending

Copy `.env.example` to `.env`, then set `SMTP_USERNAME` to the Gmail address that should send messages and `SMTP_PASSWORD` to a Google App Password. Google App Passwords require 2-Step Verification and are created from the Google Account security settings. Do not use your normal Gmail password and never place these values in frontend code.

After saving `.env`, restart Flask. HR users can then open **Email communication**, send a message, and see the delivery result. Candidate accounts do not have access to this module.
