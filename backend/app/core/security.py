import logging
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import requests
from app.core.config import settings

logger = logging.getLogger(__name__)

# Setup credential encryption
try:
    cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
except Exception as exc:
    raise RuntimeError("Invalid ENCRYPTION_KEY configuration") from exc


def encrypt_secret(plain_text: Optional[str]) -> Optional[str]:
    """Encrypt sensitive connection credential string."""
    if not plain_text:
        return None
    return cipher_suite.encrypt(plain_text.encode("utf-8")).decode("utf-8")


def decrypt_secret(cipher_text: Optional[str]) -> Optional[str]:
    """Decrypt sensitive connection credential string."""
    if not cipher_text:
        return None
    try:
        return cipher_suite.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to decrypt credential: {e}")
        return None


# HTTP Bearer scheme
security_scheme = HTTPBearer(auto_error=False)

# Cached Keycloak JWKS
_cached_jwks = None


def get_keycloak_jwks() -> Optional[Dict[str, Any]]:
    global _cached_jwks
    if _cached_jwks:
        return _cached_jwks
    try:
        jwks_url = f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/certs"
        resp = requests.get(jwks_url, timeout=3)
        if resp.status_code == 200:
            _cached_jwks = resp.json()
            return _cached_jwks
    except Exception as e:
        logger.debug(f"Could not reach Keycloak JWKS endpoint: {e}")
    return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> Dict[str, Any]:
    """Validate a Keycloak JWT from the Authorization Bearer header."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Attempt to verify with Keycloak JWKS
    jwks = get_keycloak_jwks()
    if jwks:
        try:
            unverified_header = jwt.get_unverified_header(token)
            rsa_key = {}
            for key in jwks.get("keys", []):
                if key.get("kid") == unverified_header.get("kid"):
                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key.get("use", "sig"),
                        "n": key["n"],
                        "e": key["e"],
                    }
                    break
            if rsa_key:
                payload = jwt.decode(
                    token,
                    rsa_key,
                    algorithms=["RS256"],
                    options={"verify_aud": False, "verify_signature": True},
                )
                return {
                    "sub": payload.get("sub"),
                    "username": payload.get(
                        "preferred_username", payload.get("email", "user")
                    ),
                    "email": payload.get("email"),
                }
        except JWTError as e:
            logger.warning(f"Keycloak JWT validation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Keycloak token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials with Keycloak",
        headers={"WWW-Authenticate": "Bearer"},
    )
