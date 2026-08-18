"""
Universal WSGI + ASGI Entrypoint for Render / Heroku / Production Deployment.
Automatically detects whether the caller is:
1. A WSGI server (e.g. gunicorn default sync worker, calling with 2 args: environ, start_response)
2. An ASGI server (e.g. uvicorn or gunicorn -k uvicorn.workers.UvicornWorker, calling with 3 args: scope, receive, send)
"""
import os
import sys

from server import app as fastapi_app

try:
    from a2wsgi import ASGIMiddleware
    _wsgi_adapter = ASGIMiddleware(fastapi_app)
except Exception:
    _wsgi_adapter = None

class UniversalApp:
    def __init__(self, asgi_target):
        self._asgi = asgi_target

    def __call__(self, *args, **kwargs):
        # WSGI invocation (Gunicorn default sync worker): args=(environ, start_response)
        if len(args) == 2:
            global _wsgi_adapter
            if _wsgi_adapter is None:
                from a2wsgi import ASGIMiddleware
                _wsgi_adapter = ASGIMiddleware(self._asgi)
            return _wsgi_adapter(*args, **kwargs)
        
        # ASGI invocation (Uvicorn / Gunicorn UvicornWorker): args=(scope, receive, send)
        return self._asgi(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._asgi, name)

app = UniversalApp(fastapi_app)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
