@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo Texta cache version bump (UTF-8 safe)
echo ========================================

if "%~1"=="" (
  echo Using auto version (timestamp)...
  node scripts\bump-version.js
) else (
  echo Using custom version: %~1
  node scripts\bump-version.js %~1
)

if errorlevel 1 (
  echo Failed to bump version.
  pause
  exit /b 1
)

echo.
git status --short

echo.
echo Usage:
echo   ??????.bat                ^(auto^)
echo   ??????.bat 2026.03.25.2  ^(custom^)
pause
endlocal
