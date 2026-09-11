@echo off
setlocal
rem Aetherium launcher: installs dependencies on first run, builds and opens the app in the browser.
cd /d "%~dp0"
title Aetherium

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20.19 or newer is required. Download it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies, this happens once...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Dependency installation failed. See the messages above.
    pause
    exit /b 1
  )
)

echo Building and starting Aetherium. The browser opens automatically.
echo Close this window to stop the app.
call npm start
if errorlevel 1 (
  echo Aetherium stopped with an error. See the messages above.
  pause
)
