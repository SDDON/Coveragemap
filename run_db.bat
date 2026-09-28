@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run_db.ps1" %*
if %errorlevel% neq 0 (
    pause
)
