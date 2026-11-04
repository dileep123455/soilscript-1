"""Soil Script Flask application."""

import os
from flask import Flask, render_template
from config import Config
from routes.assistant import assistant_bp
from routes.document import document_bp


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)
    app.register_blueprint(document_bp)
    app.register_blueprint(assistant_bp)

    @app.get("/")
    def index():
        return render_template("index.html", page="home")

    @app.get("/documents")
    def documents():
        return render_template("document.html", page="documents")

    @app.get("/assistant")
    def assistant():
        return render_template("assistant.html", page="assistant")

    @app.get("/crop-advisor")
    def crop_advisor():
        return render_template("crop_advisor.html", page="crop_advisor")

    @app.get("/guide")
    def guide():
        return render_template("guide.html", page="guide")

    @app.get("/crop-health")
    def disease():
        return render_template("disease.html", page="disease")

    @app.get("/farm-inputs")
    def inputs():
        return render_template("inputs.html", page="inputs")

    @app.get("/machinery")
    def machinery():
        return render_template("machinery.html", page="machinery")

    @app.get("/about")
    def about():
        return render_template("about.html", page="about")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "soil-script"}

    @app.errorhandler(413)
    def file_too_large(_error):
        return {"error": f"That file is too large. The limit is {app.config['MAX_CONTENT_LENGTH'] // (1024 * 1024)} MB."}, 413

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "0") == "1")
