# Syllabus RAG AI Agent - Production Deployment Guide

## 🚀 Quick Deployment Guide

This guide will help you deploy the Syllabus RAG AI Agent to production with zero errors.

---

## Prerequisites

- Python 3.10 or higher
- Virtual environment (recommended)
- Google Gemini API key (free at https://makersuite.google.com/app/apikey)
- 2GB RAM minimum (4GB recommended)
- 1GB free disk space

---

## Step 1: Environment Setup

### Option A: Using Virtual Environment (Recommended)

```bash
# Create virtual environment
python -m venv .venv

# Activate on Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# Activate on Windows (CMD)
.venv\Scripts\activate.bat

# Activate on macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Option B: Using Conda

```bash
# Create conda environment
conda create -n syllabus-rag python=3.10

# Activate environment
conda activate syllabus-rag

# Install dependencies
pip install -r requirements.txt
```

---

## Step 2: Configuration

### Configure Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env  # Linux/Mac
   copy .env .env        # Windows
   ```

2. Edit `.env` and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   GEMINI_MODEL=gemini-1.5-flash
   ENVIRONMENT=production
   ```

3. For production, update CORS settings:
   ```env
   CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

---

## Step 3: Verify Installation

Run these checks before deploying:

```bash
# Check Python version (should be 3.10+)
python --version

# Check syntax of all Python files
python -m py_compile server.py
python -m py_compile core/*.py

# Test imports
python -c "from core import config, vector_store, agent_engine"

# Verify dependencies
pip check
```

---

## Step 4: Start the Server

### Development Mode

```bash
python server.py
```

### Production Mode with Gunicorn (Recommended)

```bash
# Install gunicorn if not already installed
pip install gunicorn

# Start with 4 workers (adjust based on CPU cores)
gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Production Mode with Uvicorn

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Step 5: Verify Deployment

1. **Health Check**: Visit `http://your-server:8000/api/status`
   - Should return JSON with `"status": "online"`

2. **Web Interface**: Visit `http://your-server:8000/`
   - Should display the Syllabus RAG AI interface

3. **Test Document Upload**: Upload a sample PDF/DOCX
   - Go to Document Hub → Upload file
   - Verify file is indexed successfully

4. **Test AI Agent**: Ask a question
   - Type: "Hello, how are you?"
   - Verify you get a response

---

## Production Deployment Options

### Option 1: Docker Deployment (Coming Soon)

```bash
# Build Docker image
docker build -t syllabus-rag-ai .

# Run container
docker run -p 8000:8000 -e GEMINI_API_KEY=your_key syllabus-rag-ai
```

### Option 2: Heroku Deployment

The `Procfile` is already included. Deploy steps:

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set GEMINI_API_KEY=your_key
heroku config:set GEMINI_MODEL=gemini-1.5-flash

# Deploy
git push heroku main
```

### Option 3: AWS EC2 / DigitalOcean / Linode

1. Launch a Ubuntu 22.04 LTS instance (2GB RAM minimum)
2. SSH into the instance
3. Install Python 3.10+
4. Clone the repository
5. Follow steps 1-4 above
6. Set up Nginx as reverse proxy (optional)
7. Use systemd for process management

Example systemd service (`/etc/systemd/system/syllabus-rag.service`):

```ini
[Unit]
Description=Syllabus RAG AI Agent
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/syllabus-rag
Environment="PATH=/var/www/syllabus-rag/.venv/bin"
ExecStart=/var/www/syllabus-rag/.venv/bin/gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### Option 4: Render / Railway Deployment

Both platforms support automatic deployment from GitHub:

1. Connect your GitHub repository
2. Set environment variables in the platform dashboard
3. Platform will auto-detect Python and deploy

---

## Monitoring & Maintenance

### Log Files

- Application logs: `syllabus_rag.log`
- Check logs regularly: `tail -f syllabus_rag.log`

### Database Backup

```bash
# Backup SQLite database
cp syllabus.db syllabus.db.backup.$(date +%Y%m%d)

# Backup vector store
tar -czf vector_store_backup.tar.gz data/vector_db/
```

### Updates

```bash
# Pull latest code
git pull origin main

# Update dependencies
pip install --upgrade -r requirements.txt

# Restart server
# (depends on your deployment method)
```

---

## Troubleshooting

### Port Already in Use

```bash
# Use a different port
PORT=8001 python server.py
```

### ImportError for google-generativeai

```bash
pip install --upgrade google-generativeai
```

### File Upload Issues

Check permissions on `data/uploaded_docs/` directory:
```bash
chmod -R 755 data/
```

### Vector Store Not Loading

Delete and rebuild:
```bash
rm -rf data/vector_db/*
# Restart server and re-upload documents
```

---

## Security Recommendations

1. **Never commit `.env` to git** - Already in `.gitignore`
2. **Use HTTPS in production** - Set up SSL certificate
3. **Restrict CORS** - Update `CORS_ORIGINS` in `.env`
4. **Keep dependencies updated** - Run `pip list --outdated` regularly
5. **Set strong file permissions** - Especially for database and logs
6. **Enable rate limiting** - Set `RATE_LIMIT_ENABLED=true` in production
7. **Use environment variables** - Never hardcode sensitive data

---

## Performance Optimization

### For Better Performance:

1. **Use more workers**: Increase Gunicorn workers to match CPU cores
2. **Enable caching**: Consider Redis for session/cache management
3. **Optimize chunks**: Adjust `DEFAULT_CHUNK_SIZE` based on your documents
4. **Use faster model**: Switch to `gemini-1.5-flash` for speed
5. **Database indexing**: SQLite is fine for < 10K records

---

## Support & Documentation

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: See README.md for feature details
- **API Reference**: Visit `/docs` endpoint for Swagger UI
- **Community**: Join discussions on GitHub

---

## Success Checklist

- [ ] Python 3.10+ installed
- [ ] All dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file configured with Gemini API key
- [ ] Server starts without errors (`python server.py`)
- [ ] Health check endpoint returns "online" status
- [ ] Web interface loads correctly
- [ ] Can upload and index documents
- [ ] AI agent responds to queries
- [ ] Logs are being written to `syllabus_rag.log`

---

## Production Deployment Completed! 🎉

Your Syllabus RAG AI Agent is now production-ready with:
- ✅ Zero syntax errors
- ✅ Comprehensive error handling
- ✅ Production-grade logging
- ✅ Secure environment configuration
- ✅ Multiple deployment options
- ✅ Health monitoring
- ✅ Scalability ready

**Server URL**: `http://localhost:8000`

Enjoy your flagship academic AI platform! 🎓🚀
