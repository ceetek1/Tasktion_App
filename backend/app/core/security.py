import threading

import httpx
from jose import jwt, JWTError
from app.core.config import settings

_jwks_lock = threading.Lock()
_jwks: dict[str, dict] = {}


def _jwks_url() -> str:
    return f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _signing_key(kid: str | None) -> dict:
    """Return the project's public key for `kid`, refetching the JWKS when it's unknown (key rotation)."""
    with _jwks_lock:
        if kid not in _jwks:
            response = httpx.get(_jwks_url(), timeout=5)
            response.raise_for_status()
            _jwks.clear()
            _jwks.update({key["kid"]: key for key in response.json().get("keys", [])})
        key = _jwks.get(kid)
    if key is None:
        raise JWTError("Unknown signing key")
    return key


def verify_supabase_token(token: str) -> dict:
    """Verify a Supabase Auth access token and return its claims. Raises JWTError if invalid."""
    header = jwt.get_unverified_header(token)
    algorithm = header.get("alg")
    if algorithm == "HS256":
        if not settings.SUPABASE_JWT_SECRET:
            raise JWTError("HS256 tokens are not accepted")
        key = settings.SUPABASE_JWT_SECRET
    elif algorithm in {"ES256", "RS256"} and settings.SUPABASE_URL:
        try:
            key = _signing_key(header.get("kid"))
        except httpx.HTTPError as exc:
            raise JWTError("Could not fetch signing keys") from exc
    else:
        raise JWTError("Unsupported token algorithm")
    return jwt.decode(token, key, algorithms=[algorithm], audience="authenticated")
