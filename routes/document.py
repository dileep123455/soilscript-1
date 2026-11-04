"""Document OCR and plain-text translation endpoints."""

from flask import Blueprint, current_app, jsonify, request
from services.sarvam_client import SarvamError, chat_reply, get_document_parse_result, start_document_parse, translate_text

document_bp = Blueprint("document_api", __name__, url_prefix="/api/document")
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
LANGUAGES = {"hi-IN", "kn-IN", "ta-IN", "te-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "od-IN", "en-IN"}


def _summary(text, target_language):
    prompt = (
        "You explain farm documents to small and marginal farmers. Read the supplied text carefully. "
        "Return exactly 3 or 4 short lines in the requested language, using everyday words. "
        "Tell the farmer what this document asks them to do, any date/amount/dose/deadline, and one important caution. "
        "Do not invent details or change numbers. If a detail is unclear, say it is unclear. "
        "This is an explanation, not professional legal, financial, or pesticide advice."
    )
    return chat_reply([
        {"role": "user", "content": f"Requested language code: {target_language}\n\nDocument text:\n{text[:10000]}"}
    ], prompt, max_tokens=300)


@document_bp.post("/translate")
def translate_document():
    target = request.form.get("target_language", "hi-IN")
    source = request.form.get("source_language", "en-IN")
    if target not in LANGUAGES or source not in LANGUAGES:
        return jsonify(error="Choose a supported language."), 400
    uploaded = request.files.get("file")
    typed_text = (request.form.get("text") or "").strip()
    if uploaded and uploaded.filename:
        name = uploaded.filename.lower()
        extension = "." + name.rsplit(".", 1)[-1] if "." in name else ""
        if extension not in ALLOWED_EXTENSIONS:
            return jsonify(error="Upload a PDF, PNG, JPG, JPEG, or WEBP file."), 400
        if uploaded.content_length and uploaded.content_length > current_app.config["MAX_CONTENT_LENGTH"]:
            return jsonify(error="That file is too large. Please choose a smaller file."), 413
    elif not typed_text:
        return jsonify(error="Upload a document or paste its text first."), 400
    if len(typed_text) > 12000:
        return jsonify(error="Pasted text is too long. Please keep it under 12,000 characters."), 400

    try:
        if uploaded and uploaded.filename:
            job_id = start_document_parse(uploaded, source)
            return jsonify(status="processing", job_id=job_id, language=target), 202
        original = typed_text
        summary = _summary(original, target)
        return jsonify(status="completed", original_text=original, summary=summary, language=target)
    except SarvamError as exc:
        return jsonify(error=str(exc)), 503


@document_bp.get("/jobs/<job_id>")
def document_job_status(job_id):
    target = request.args.get("target_language", "hi-IN")
    if target not in LANGUAGES:
        return jsonify(error="Choose a supported language."), 400
    try:
        status, original = get_document_parse_result(job_id)
        if status not in {"completed", "partially_completed"}:
            return jsonify(status="processing"), 202
        summary = _summary(original, target)
        return jsonify(status="completed", original_text=original, summary=summary, language=target)
    except SarvamError as exc:
        return jsonify(error=str(exc)), 503


@document_bp.post("/text-translate")
def translate_text_endpoint():
    data = request.get_json(silent=True) or {}
    source = data.get("source_language", "en-IN")
    target = data.get("target_language", "hi-IN")
    if source not in LANGUAGES or target not in LANGUAGES:
        return jsonify(error="Choose a supported language."), 400
    try:
        translated = translate_text(
            data.get("text", ""),
            source,
            target,
        )
        return jsonify(translated_text=translated)
    except SarvamError as exc:
        return jsonify(error=str(exc)), 503
