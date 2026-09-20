from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "RagTeach"
    enable_reranking: bool = False
    data_dir: Path = Path(__file__).resolve().parents[4] / "data"
    ollama_base_url: str = "http://127.0.0.1:11434"
    default_llm_model: str = "qwen2.5:14b-instruct-q4_K_M"
    default_embed_model: str = "nomic-embed-text"
    whisper_model: str = "medium"
    whisper_device: str = "cuda"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    # Fernet key derived from this passphrase for local key encryption
    secrets_passphrase: str = "ragteach-local-dev-change-me"

    @property
    def pdf_dir(self) -> Path:
        return self.data_dir / "pdfs"

    @property
    def lance_dir(self) -> Path:
        return self.data_dir / "lancedb"

    @property
    def settings_dir(self) -> Path:
        return self.data_dir / "settings"

    def ensure_dirs(self) -> None:
        self.pdf_dir.mkdir(parents=True, exist_ok=True)
        self.lance_dir.mkdir(parents=True, exist_ok=True)
        self.settings_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
