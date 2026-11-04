"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "local-soil-script-key-change-me")
    SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "").strip()
    SARVAM_BASE_URL = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai").rstrip("/")
    SARVAM_CHAT_MODEL = os.getenv("SARVAM_CHAT_MODEL", "sarvam-105b-conversations")
    SARVAM_TTS_MODEL = os.getenv("SARVAM_TTS_MODEL", "bulbul:v3")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_MB", "12")) * 1024 * 1024
    JSON_SORT_KEYS = False
