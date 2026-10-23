@echo off
setlocal
rem Aetherium launcher: installs dependencies when they are missing or out of date, builds and opens the app in the browser.
cd /d "%~dp0"
title Aetherium

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20.19 or newer is required. Download it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

rem npm records the installed tree in node_modules\.package-lock.json. A package-lock.json newer
rem than that record means an update brought new dependencies, so they are installed again,
rem exactly as locked (npm ci does not rewrite the lockfile).
node -e "const fs=require('fs');try{process.exit(fs.statSync('package-lock.json').mtimeMs>fs.statSync('node_modules/.package-lock.json').mtimeMs?1:0)}catch{process.exit(1)}"
if errorlevel 1 (
  echo Installing dependencies...
  call npm ci --no-audit --no-fund
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
