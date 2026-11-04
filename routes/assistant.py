"""Regional-language farmer assistant and voice endpoints."""

from flask import Blueprint, jsonify, request, send_file
from io import BytesIO
from services.sarvam_client import SarvamError, chat_reply, text_to_speech, transcribe_audio

assistant_bp = Blueprint("assistant_api", __name__, url_prefix="/api/assistant")
LANGUAGES = {"hi-IN", "kn-IN", "ta-IN", "te-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "od-IN", "en-IN"}
SYSTEM_PROMPT = (
    "You are Soil Script, a patient, practical farming information helper for small and marginal farmers in India. "
    "Reply in the language requested by the user. Use short sentences and everyday words. "
    "Give general education only: do not invent pesticide doses, withdrawal periods, crop disease diagnoses, "
    "government benefit eligibility, loan terms, or guaranteed yields. For chemical use, ask the farmer to follow "
    "the product label and consult a local agriculture officer/KVK. For urgent health or poisoning concerns, "
    "tell them to contact emergency services or a doctor immediately. If information is missing, ask one clear question."
)


@assistant_bp.post("/chat")
def chat():
    data = request.get_json(silent=True) or {}
    language = data.get("language", "hi-IN")
    if language not in LANGUAGES:
        return jsonify(error="Choose a supported language."), 400
    incoming = data.get("messages", [])
    if not isinstance(incoming, list):
        return jsonify(error="Messages must be a list."), 400
    safe_messages = []
    for item in incoming[-8:]:
        if not isinstance(item, dict) or item.get("role") not in {"user", "assistant"}:
            continue
        content = str(item.get("content", "")).strip()[:1600]
        if content:
            safe_messages.append({"role": item["role"], "content": content})
    if not safe_messages or safe_messages[-1]["role"] != "user":
        return jsonify(error="Write a question first."), 400
    prompt = f"{SYSTEM_PROMPT}\n\nRespond in language code {language}."
    try:
        return jsonify(reply=chat_reply(safe_messages, prompt, max_tokens=500))
    except SarvamError as exc:
        return jsonify(error=str(exc)), 503


@assistant_bp.post("/transcribe")
def transcribe():
    audio = request.files.get("audio")
    language = request.form.get("language", "unknown")
    if not audio or not audio.filename:
        return jsonify(error="Record a short voice note first."), 400
    if audio.content_length and audio.content_length > 10 * 1024 * 1024:
        return jsonify(error="The recording is too large. Please record a shorter voice note."), 413
    try:
        return jsonify(transcript=transcribe_audio(audio, language))
    except SarvamError as exc:
        return jsonify(error=str(exc)), 503


@assistant_bp.post("/speech")
def speech():
    data = request.get_json(silent=True) or {}
    language = data.get("language", "hi-IN")
    if language not in LANGUAGES:
        return jsonify(error="Choose a supported language."), 400
    try:
        audio_bytes, content_type = text_to_speech(data.get("text", ""), language)
        return send_file(BytesIO(audio_bytes), mimetype=content_type, as_attachment=False, download_name="soil-script-voice.wav")
    except SarvamError as exc:
        return jsonify(error=str(exc)), 503
