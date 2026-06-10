@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\" (
    echo.
    echo Dependencies are not installed.
    echo Run manually:
    echo.
    echo     npm install
    echo.
    pause
    exit /b 1
)

npm run dev
