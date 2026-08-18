"""
Render / Production ASGI Entrypoint.
Exposes the FastAPI application from server.py.
"""
import os
from server import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
