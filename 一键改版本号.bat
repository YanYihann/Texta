@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo Texta cache version bump UTF-8 safe
echo ========================================

set "ARG_VER=%~1"
if "%ARG_VER%"=="" goto AUTO

echo Using custom version: %ARG_VER%
node scripts\bump-version.js %ARG_VER%
goto AFTER

:AUTO
echo Using auto version timestamp
node scripts\bump-version.js

:AFTER
if errorlevel 1 (
  echo Failed to bump version.
  echo Press any key to close...
  pause >nul
  exit /b 1
)

echo.
git status --short

echo.
echo Usage:
echo   run this file directly for auto version
echo   run with arg, e.g. 2026.03.25.3

echo.
echo Done. Press any key to close...
pause >nul
endlocal
