@echo off
cd /d "%~dp0"
start "Kalimba Server" cmd /k "cd /d ""%~dp0"" && node serve-kalimba.js"
timeout /t 1 >nul
start "" http://localhost:8123/index.html
