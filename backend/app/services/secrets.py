"""Encryption at rest for organizations' API keys (Fernet: AES-128-CBC + HMAC-SHA256).

The key comes from settings.FIELD_ENCRYPTION_KEY. Development without one derives a
key from SECRET_KEY, so a laptop works out of the box; production must set it.
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class SecretUnavailable(RuntimeError):
    """A stored secret can't be decrypted (the encryption key changed)."""


def _fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        digest = hashlib.sha256(f"catsight-field-encryption:{settings.SECRET_KEY}".encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as e:
        raise SecretUnavailable(
            "The saved API key can't be read (the server's encryption key changed). Enter it again in Settings."
        ) from e
