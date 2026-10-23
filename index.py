"""Vercel entrypoint: Vercel looks for a FastAPI `app` in a root file like this one."""
import sys
from pathlib import Path

# The app package lives in backend/ and imports itself as `app`
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app.main import app  # noqa: E402,F401
