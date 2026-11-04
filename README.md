# Soil Script

Soil Script is a Flask website for making farm documents and practical farming information easier to understand. It uses vanilla HTML, CSS, and JavaScript in the browser, with Python blueprints on the server and Sarvam APIs for AI features.

## Features

- Upload a PDF or photo and get a short explanation in a selected language.
- Paste document text for a quick explanation without OCR.
- Listen to document summaries and assistant replies using Bulbul text-to-speech.
- Ask the farm assistant by typing or recording a short voice note.
- Explore a broad crop planning shortlist, a season checklist, crop observation prompts, input safety notes, and equipment summaries.
- Responsive layout, keyboard focus styles, reduced motion support, and accessible status messages.

The planning guides are educational starting points. They do not use local weather, soil test results, live market information, or official scheme data. Verify important details with product labels, local agriculture offices/KVKs, banks, and government offices.

## Project files

```text
soil-script/
├── .env.example
├── .gitignore
├── Procfile
├── README.md
├── app.py
├── config.py
├── render.yaml
├── requirements.txt
├── routes/
│   ├── __init__.py
│   ├── assistant.py
│   └── document.py
├── services/
│   ├── __init__.py
│   └── sarvam_client.py
├── static/
│   ├── css/style.css
│   └── js/
│       ├── assistant.js
│       ├── document.js
│       └── site.js
└── templates/
    ├── about.html
    ├── assistant.html
    ├── base.html
    ├── crop_advisor.html
    ├── disease.html
    ├── document.html
    ├── guide.html
    ├── index.html
    ├── inputs.html
    └── machinery.html
```

## Run locally

Use Python 3.9 or newer.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and set `SARVAM_API_KEY` to a key from the Sarvam dashboard. Keep this key private; it is read only by the Python server. Then run:

```bash
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000). Without a Sarvam key, the informational pages still work and the AI endpoints return a setup message.

## Deploy to Render

1. Push this project to a Git repository.
2. Create a Render Web Service from that repository. `render.yaml` includes the build command, Gunicorn start command, health check, and generated Flask secret.
3. Add `SARVAM_API_KEY` in the Render environment settings. Do not commit `.env` or put the key in browser JavaScript.
4. Deploy. Render serves the Flask application on its assigned `PORT`.

The document OCR endpoint starts Sarvam Vision's asynchronous parse job and the browser polls for completion. The application does not persist uploaded files locally.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/document/translate` | Start OCR for an upload or explain pasted text |
| `GET` | `/api/document/jobs/<job_id>` | Poll OCR and return the explanation when ready |
| `POST` | `/api/document/text-translate` | Translate a short text snippet |
| `POST` | `/api/assistant/chat` | Get a regional language assistant reply |
| `POST` | `/api/assistant/transcribe` | Transcribe a short voice recording |
| `POST` | `/api/assistant/speech` | Create audio from text |
| `GET` | `/health` | Render health check |

## Sarvam API references

- [Authentication](https://docs.sarvam.ai/api-reference/authentication) — the subscription key is sent from the server.
- [Sarvam Vision document parse](https://docs.sarvam.ai/api-reference/doc-ai/job/parse) — OCR job creation.
- [Document job status](https://docs.sarvam.ai/api-reference/doc-ai/job/status) and [download URL](https://docs.sarvam.ai/api-reference/doc-ai/job/download-url) — asynchronous OCR results.
- [Chat completions](https://docs.sarvam.ai/api-reference/chat/chat-completions-v1) — document explanations and assistant responses.
- [Text translation](https://docs.sarvam.ai/api-reference/text/translate-text) — short text translation.
- [Speech to text](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe) and [text to speech](https://docs.sarvam.ai/api-reference/text-to-speech/convert) — voice features.

## Notes for a production launch

The included app is a hackathon-ready starter, not a complete regulated farm advisory service. Before wider deployment, add account or rate controls for paid AI endpoints, stronger file inspection, monitoring, and a review process for language and agricultural guidance. Do not rely on AI output for exact chemical instructions, diagnosis, financial decisions, or eligibility determinations.
