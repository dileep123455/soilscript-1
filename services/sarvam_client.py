"""Small, server-side REST wrappers for Sarvam APIs.

The browser never receives the Sarvam subscription key. Endpoints and payloads
follow the Sarvam Model APIs REST contracts; all network requests have bounded
timeouts and raise readable errors for the routes to return to the UI.
"""

import base64
import io
import re
import zipfile
from html.parser import HTMLParser

import requests
from flask import current_app


class SarvamError(Exception):
    """A safe-to-display Sarvam request error."""


def _settings():
    key = current_app.config.get("SARVAM_API_KEY", "")
    if not key:
        raise SarvamError("Sarvam is not connected yet. Add SARVAM_API_KEY to your .env file, then restart the server.")
    return current_app.config["SARVAM_BASE_URL"], {"api-subscription-key": key}


def _json_request(method, path, **kwargs):
    base_url, headers = _settings()
    try:
        response = requests.request(method, f"{base_url}{path}", headers=headers, timeout=kwargs.pop("timeout", 25), **kwargs)
    except requests.RequestException as exc:
        raise SarvamError("Could not reach Sarvam. Check the connection and try again.") from exc
    if not response.ok:
        detail = ""
        try:
            data = response.json()
            detail = data.get("error", {}).get("message", "") if isinstance(data.get("error"), dict) else str(data.get("error", ""))
            detail = detail or data.get("message", "")
        except (ValueError, AttributeError):
            pass
        raise SarvamError(detail[:260] or f"Sarvam returned HTTP {response.status_code}. Please try again.")
    try:
        return response.json()
    except ValueError as exc:
        raise SarvamError("Sarvam returned an unexpected response. Please try again.") from exc


def translate_text(text, source_language="en-IN", target_language="hi-IN"):
    """Translate a short string using Sarvam Translate."""
    text = (text or "").strip()
    if not text:
        raise SarvamError("Enter some text to translate.")
    if len(text) > 1800:
        raise SarvamError("Please keep text under 1,800 characters for translation.")
    result = _json_request("POST", "/translate", json={
        "input": text,
        "source_language_code": source_language,
        "target_language_code": target_language,
        "model": "sarvam-translate:v1",
        "mode": "formal",
    })
    return result.get("translated_text", "")


def chat_reply(messages, system_prompt, max_tokens=420):
    """Get one response from the configured Sarvam conversational model."""
    payload = {
        "model": current_app.config.get("SARVAM_CHAT_MODEL", "sarvam-105b-conversations"),
        "messages": [{"role": "system", "content": system_prompt}, *messages],
        "temperature": 0.25,
        "max_tokens": max_tokens,
    }
    result = _json_request("POST", "/v1/chat/completions", json=payload, timeout=45)
    try:
        return result["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise SarvamError("Sarvam returned an unexpected chat response. Please try again.") from exc


def text_to_speech(text, language_code):
    """Create speech audio and return decoded WAV/MP3 bytes and MIME type."""
    text = (text or "").strip()
    if not text or len(text) > 2400:
        raise SarvamError("Speech text must contain 1 to 2,400 characters.")
    result = _json_request("POST", "/text-to-speech", json={
        "text": text,
        "language_code": language_code,
        "model": current_app.config.get("SARVAM_TTS_MODEL", "bulbul:v3"),
        "speech_sample_rate": 22050,
        "output_audio_codec": "wav",
    }, timeout=45)
    audios = result.get("audios") or []
    if not audios:
        raise SarvamError("No audio was returned. Please try again.")
    try:
        return base64.b64decode(audios[0]), "audio/wav"
    except (ValueError, TypeError) as exc:
        raise SarvamError("Sarvam returned invalid audio. Please try again.") from exc


def transcribe_audio(file_storage, language_code="unknown"):
    """Transcribe a short browser recording with Saaras."""
    base_url, headers = _settings()
    files = {"file": (file_storage.filename or "voice.webm", file_storage.stream, file_storage.mimetype or "audio/webm")}
    try:
        response = requests.post(
            f"{base_url}/speech-to-text",
            headers=headers,
            files=files,
            data={"model": "saaras:v4", "language_code": language_code or "unknown"},
            timeout=40,
        )
    except requests.RequestException as exc:
        raise SarvamError("Could not reach speech recognition. Check the connection and try again.") from exc
    if not response.ok:
        raise SarvamError(f"Speech recognition failed (HTTP {response.status_code}). Please try again or type your question.")
    try:
        return response.json().get("transcript", "").strip()
    except ValueError as exc:
        raise SarvamError("Speech recognition returned an unexpected response.") from exc


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden_depth = 0

    def handle_starttag(self, tag, _attrs):
        if tag in {"script", "style", "head"}:
            self.hidden_depth += 1
        elif tag in {"p", "div", "tr", "li", "h1", "h2", "h3", "br"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "head"} and self.hidden_depth:
            self.hidden_depth -= 1
        elif tag in {"p", "div", "tr", "li", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden_depth:
            self.parts.append(data)


def _clean_document_text(raw, suffix):
    if suffix == ".html":
        parser = _TextExtractor()
        parser.feed(raw)
        raw = "".join(parser.parts)
    raw = re.sub(r"[ \t]+", " ", raw)
    raw = re.sub(r"\n\s*\n\s*\n+", "\n\n", raw)
    return raw.strip()


def start_document_parse(file_storage, language_code="en-IN"):
    """Submit a Sarvam Vision parse job and return its opaque job ID."""
    base_url, headers = _settings()
    filename = file_storage.filename or "farm-document.pdf"
    try:
        response = requests.post(
            f"{base_url}/doc-ai/v1/job/parse",
            headers=headers,
            files={"file": (filename, file_storage.stream, file_storage.mimetype or "application/octet-stream")},
            data={"language": language_code, "content_type": "printed"},
            timeout=40,
        )
    except requests.RequestException as exc:
        raise SarvamError("Could not reach the document reader. Check the connection and try again.") from exc
    if not response.ok:
        raise SarvamError(f"Document reading failed (HTTP {response.status_code}). Check the file and try again.")
    try:
        job_id = response.json().get("job_id")
    except ValueError as exc:
        raise SarvamError("Document reader returned an unexpected response.") from exc
    if not job_id:
        raise SarvamError("Document reader did not start a job. Please try again.")
    return job_id


def get_document_parse_result(job_id):
    """Return the job status, and extracted text once Sarvam Vision is done."""
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", job_id or ""):
        raise SarvamError("That document job could not be found.")
    status_data = _json_request("GET", f"/doc-ai/v1/job/{job_id}/status", timeout=18)
    status = str(status_data.get("status", "pending")).lower()
    if status in {"failed", "rejected"}:
        raise SarvamError("The document could not be read. Try a clearer photo or a smaller PDF.")
    if status not in {"completed", "partially_completed"}:
        return status, ""

    download = _json_request("GET", f"/doc-ai/v1/job/{job_id}/download-url", timeout=18)
    try:
        download_response = requests.request(
            download.get("method", "GET"), download["url"], headers=download.get("headers") or {}, timeout=35
        )
    except requests.RequestException as exc:
        raise SarvamError("The document was read, but its result could not be downloaded. Please try again.") from exc
    if not download_response.ok:
        raise SarvamError("The document was read, but its result could not be downloaded. Please try again.")
    try:
        with zipfile.ZipFile(io.BytesIO(download_response.content)) as archive:
            members = [name for name in archive.namelist() if name.lower().endswith((".md", ".html", ".txt"))]
            if not members:
                raise SarvamError("The reader found no text in that file. Try another image or PDF.")
            primary = max(members, key=lambda name: len(archive.read(name)))
            suffix = ".html" if primary.lower().endswith(".html") else ".md" if primary.lower().endswith(".md") else ".txt"
            extracted = archive.read(primary).decode("utf-8", errors="replace")
    except zipfile.BadZipFile as exc:
        raise SarvamError("The document reader returned a file in an unexpected format.") from exc
    extracted = _clean_document_text(extracted, suffix)
    if len(extracted) < 20:
        raise SarvamError("Very little text was found. Try a clearer photo with the full page in frame.")
    return status, extracted[:18000]
