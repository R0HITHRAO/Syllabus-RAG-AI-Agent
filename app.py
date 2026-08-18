"""
Render / Production WSGI & ASGI entrypoint alias.
Imports the FastAPI application from server.py to support both:
- gunicorn server:app
- gunicorn app:app
"""
from server import app

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
