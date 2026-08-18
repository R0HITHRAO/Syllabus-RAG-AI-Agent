# ==============================================================================
# Gunicorn Configuration File for Render / Cloud Production Deployment
# Automatically detected and loaded by Gunicorn when starting the web service.
# ==============================================================================
import os

# Bind to the dynamic port assigned by Render (or default to 8000)
port = os.environ.get("PORT", "8000")
bind = f"0.0.0.0:{port}"

# Use Uvicorn's asynchronous worker class for FastAPI (Prevents sync worker deadlocks)
worker_class = "uvicorn.workers.UvicornWorker"

# Worker process count
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))

# Timeout settings (in seconds)
timeout = 120
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
