from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

from cryptography.fernet import Fernet

from app.core.config import settings
from app.core.models import AppSettings


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.secrets_passphrase.encode()).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


class SettingsStore:
    def __init__(self) -> None:
        self.settings_path = settings.settings_dir / "settings.json"
        self.keys_path = settings.settings_dir / "keys.json"
        self._ensure()

    def _ensure(self) -> None:
        if not self.settings_path.exists():
            self.save_settings(AppSettings())
        if not self.keys_path.exists():
            self.keys_path.write_text("{}", encoding="utf-8")

    def load_settings(self) -> AppSettings:
        data = json.loads(self.settings_path.read_text(encoding="utf-8"))
        return AppSettings.model_validate(data)

    def save_settings(self, app_settings: AppSettings) -> AppSettings:
        payload = json.dumps(
            app_settings.model_dump(),
            indent=2,
            ensure_ascii=False,
        )
        self.settings_path.write_text(payload, encoding="utf-8")
        return app_settings

    def list_key_refs(self) -> list[str]:
        raw = json.loads(self.keys_path.read_text(encoding="utf-8"))
        return sorted(raw.keys())

    def set_key(self, ref: str, api_key: str) -> None:
        raw = json.loads(self.keys_path.read_text(encoding="utf-8"))
        token = _fernet().encrypt(api_key.encode()).decode()
        raw[ref] = token
        self.keys_path.write_text(json.dumps(raw, indent=2), encoding="utf-8")

    def get_key(self, ref: str | None) -> str | None:
        if not ref:
            return None
        raw = json.loads(self.keys_path.read_text(encoding="utf-8"))
        token = raw.get(ref)
        if not token:
            return None
        return _fernet().decrypt(token.encode()).decode()

    def delete_key(self, ref: str) -> bool:
        raw = json.loads(self.keys_path.read_text(encoding="utf-8"))
        if ref not in raw:
            return False
        del raw[ref]
        self.keys_path.write_text(json.dumps(raw, indent=2), encoding="utf-8")
        return True


store = SettingsStore()
