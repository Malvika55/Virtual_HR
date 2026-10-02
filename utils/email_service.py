import os
import smtplib
from email.message import EmailMessage


def send_email(recipient: str, subject: str, message: str) -> bool:
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    if not username or not password:
        raise ValueError("Configure SMTP_USERNAME and SMTP_PASSWORD in .env. SMTP_PASSWORD must be a Gmail App Password.")
    if not recipient or not subject or not message:
        raise ValueError("Recipient, subject, and message are required.")
    email = EmailMessage()
    email["From"] = os.getenv("SMTP_FROM", username)
    email["To"] = recipient
    email["Subject"] = subject
    email.set_content(message)
    try:
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=20) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(email)
    except smtplib.SMTPAuthenticationError as error:
        raise ValueError("Gmail authentication failed. Use a Gmail App Password, not your normal Gmail password.") from error
    except (smtplib.SMTPException, OSError) as error:
        raise ValueError(f"Gmail could not send this message: {error}") from error
    return True
