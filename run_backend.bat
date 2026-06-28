@echo off
echo Starting CoverageMap Backend on port 8190...
cd backend
uv run uvicorn main:app --reload --port 8190
pause
