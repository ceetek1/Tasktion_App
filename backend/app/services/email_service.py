import smtplib
import logging
from email.message import EmailMessage
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to_address: str, subject: str, body: str) -> bool:
    """Send an email via SMTP. Returns True on success, False on failure."""
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = "noreply@taskflow.com"
    message["To"] = to_address
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.MAILTRAP_HOST, settings.MAILTRAP_PORT) as server:
            server.starttls()
            server.login(settings.MAILTRAP_USER, settings.MAILTRAP_PASSWORD)
            server.send_message(message)
        logger.info("Email sent to %s with subject: %s", to_address, subject)
        return True
    except smtplib.SMTPException as e:
        logger.error("Failed to send email to %s: %s", to_address, e)
        return False
    except OSError as e:
        logger.error("SMTP connection error for %s: %s", to_address, e)
        return False