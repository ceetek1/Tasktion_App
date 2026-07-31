import smtplib
from email.message import EmailMessage
from app.core.config import settings


def send_email(to_address: str, subject: str, body: str):
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = "noreply@taskflow.com"
    message["To"] = to_address
    message.set_content(body)

    with smtplib.SMTP(settings.MAILTRAP_HOST, settings.MAILTRAP_PORT) as server:
         server.starttls()
         server.login(settings.MAILTRAP_USER, settings.MAILTRAP_PASSWORD)
         server.send_message(message)