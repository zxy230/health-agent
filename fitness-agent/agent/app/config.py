from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@dataclass(slots=True)
class Settings:
    app_name: str = "Health Agent Service"
    backend_base_url: str = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:3001")
    llm_model_id: str = os.getenv("LLM_MODEL_ID", "openai/gpt-5-mini")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
    llm_timeout: float = float(os.getenv("LLM_TIMEOUT", "30"))
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.3"))
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "1200"))
    amap_api_key: str = os.getenv("AMAP_API_KEY", "")

    def llm_config_warnings(self) -> list[str]:
        warnings: list[str] = []
        if not self.llm_api_key:
            warnings.append("LLM_API_KEY is not configured.")
        if not self.llm_base_url:
            warnings.append("LLM_BASE_URL is not configured.")
        if not self.llm_model_id:
            warnings.append("LLM_MODEL_ID is not configured.")
        if self.llm_timeout <= 0:
            warnings.append("LLM_TIMEOUT must be greater than zero.")
        if self.llm_max_tokens <= 0:
            warnings.append("LLM_MAX_TOKENS must be greater than zero.")
        return warnings


settings = Settings()
