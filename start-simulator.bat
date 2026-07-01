@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "URL=http://localhost:5173"

REM Make sure Node/npm are on PATH for this session (adjust if installed elsewhere).
set "PATH=C:\Program Files\nodejs;%PATH%"

cd /d "%PROJECT_DIR%"

REM Open the browser after a short delay so the dev server has time to come up.
start "" cmd /c "timeout /t 3 /nobreak >nul && start %URL%"

echo Starting Conductor Slap Simulator dev server...
npm run dev
