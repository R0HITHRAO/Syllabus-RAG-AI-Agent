@echo off
REM Production startup script for Syllabus RAG AI Agent (Windows)

echo ==================================
echo Syllabus RAG AI Agent - Startup
echo ==================================
echo.

REM Check Python version
echo Checking Python version...
python --version
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.10 or higher.
    pause
    exit /b 1
)
echo [OK] Python is installed
echo.

REM Check if virtual environment is activated
if not defined VIRTUAL_ENV (
    echo [WARNING] Virtual environment not activated. Recommended to use venv.
    echo To activate: .venv\Scripts\activate
    echo.
)

REM Check if .env file exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo Creating .env from template...
    if exist .env.example (
        copy .env.example .env
    )
    echo [WARNING] Please configure .env with your Gemini API key
    echo Get your free API key at: https://makersuite.google.com/app/apikey
    pause
    exit /b 1
)

REM Load environment variables from .env
for /f "tokens=*" %%i in ('type .env ^| findstr /v "^#"') do set %%i

REM Check if API key is configured
if "%GEMINI_API_KEY%"=="your_google_gemini_api_key_here" (
    echo [WARNING] Gemini API key not configured in .env
    echo The application will run with limited functionality.
    echo Get your free API key at: https://makersuite.google.com/app/apikey
    echo.
)

REM Check if dependencies are installed
echo Checking dependencies...
python -c "import fastapi, uvicorn, google.generativeai" 2>nul
if errorlevel 1 (
    echo [ERROR] Missing dependencies!
    echo Installing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)
echo [OK] Core dependencies installed
echo.

REM Create necessary directories
echo Creating directories...
if not exist data\uploaded_docs mkdir data\uploaded_docs
if not exist data\vector_db mkdir data\vector_db
if not exist web\css mkdir web\css
if not exist web\js mkdir web\js
echo [OK] Directories ready
echo.

REM Set default port if not configured
if not defined PORT set PORT=8000

echo ==================================
echo Starting server...
echo ==================================
echo.
echo Server will be available at:
echo   http://localhost:%PORT%
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the server
if "%ENVIRONMENT%"=="production" (
    echo Starting in PRODUCTION mode with Uvicorn...
    uvicorn server:app --host 0.0.0.0 --port %PORT% --workers 4
) else (
    echo Starting in DEVELOPMENT mode...
    python server.py
)

if errorlevel 1 (
    echo.
    echo [ERROR] Server failed to start!
    echo Common issues:
    echo   - Port %PORT% is already in use
    echo   - Missing dependencies
    echo   - Configuration error in .env
    echo.
    pause
    exit /b 1
)
