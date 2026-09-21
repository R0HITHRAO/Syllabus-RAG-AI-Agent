#!/bin/bash
# Production startup script for Syllabus RAG AI Agent

set -e  # Exit on error

echo "=================================="
echo "Syllabus RAG AI Agent - Startup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python version
echo "Checking Python version..."
PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION"

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo -e "${YELLOW}⚠${NC} Virtual environment not activated. Recommended to use venv."
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}✗${NC} .env file not found!"
    echo "Creating .env from template..."
    cp .env.example .env 2>/dev/null || cp .env .env.example 2>/dev/null || true
    echo -e "${YELLOW}⚠${NC} Please configure .env with your Gemini API key"
    exit 1
fi

# Load environment variables
source .env 2>/dev/null || export $(cat .env | grep -v '^#' | xargs) 2>/dev/null || true

# Check if API key is configured
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_google_gemini_api_key_here" ]; then
    echo -e "${YELLOW}⚠${NC} Gemini API key not configured in .env"
    echo "The application will run with limited functionality."
    echo "Get your free API key at: https://makersuite.google.com/app/apikey"
fi

# Check if dependencies are installed
echo ""
echo "Checking dependencies..."
python -c "import fastapi, uvicorn, google.generativeai" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Core dependencies installed"
else
    echo -e "${RED}✗${NC} Missing dependencies!"
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Create necessary directories
echo ""
echo "Creating directories..."
mkdir -p data/uploaded_docs data/vector_db web/css web/js
echo -e "${GREEN}✓${NC} Directories ready"

# Check if port is available
PORT=${PORT:-8000}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}✗${NC} Port $PORT is already in use!"
    echo "Try using a different port: PORT=8001 ./start.sh"
    exit 1
fi

# Start the server
echo ""
echo "=================================="
echo "Starting server..."
echo "=================================="
echo ""
echo "Server will be available at:"
echo "  http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start with production settings
if [ "$ENVIRONMENT" = "production" ]; then
    echo "Starting in PRODUCTION mode with Gunicorn..."
    gunicorn server:app \
        -w 4 \
        -k uvicorn.workers.UvicornWorker \
        --bind 0.0.0.0:$PORT \
        --access-logfile syllabus_rag_access.log \
        --error-logfile syllabus_rag_error.log
else
    echo "Starting in DEVELOPMENT mode..."
    python server.py
fi
