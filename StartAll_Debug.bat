@echo off
setlocal
cd /d "%~dp0"
title Texta Start Debug

set LOGFILE=%~dp0start_debug.log
echo ===== Texta Debug Start %date% %time% ===== > "%LOGFILE%"
echo Project: %cd% >> "%LOGFILE%"

echo Running... Please wait.
echo Running... Please wait. >> "%LOGFILE%"

if not exist "node_modules" (
  echo Installing dependencies... >> "%LOGFILE%"
  call npm.cmd install >> "%LOGFILE%" 2>&1
  if errorlevel 1 goto :fail
)

if exist "node_modules\.prisma\client\query_engine-windows.dll.node" (
  echo Prisma client exists, skip generate. >> "%LOGFILE%"
) else (
  echo Generating Prisma client... >> "%LOGFILE%"
  call npm.cmd run db:generate >> "%LOGFILE%" 2>&1
  if errorlevel 1 goto :fail
)

echo Pushing DB schema... >> "%LOGFILE%"
call npm.cmd run db:push -- --skip-generate >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :fail

echo Starting backend window... >> "%LOGFILE%"
start "Texta Backend" cmd /k "cd /d %~dp0 && npm.cmd start"

echo Starting Prisma Studio window... >> "%LOGFILE%"
start "Texta Prisma Studio" cmd /k "cd /d %~dp0 && npm.cmd run db:studio"

timeout /t 2 >nul
start "" "http://localhost:3000/index.html"
start "" "http://localhost:5555"

echo SUCCESS. See log: %LOGFILE%
echo SUCCESS. See log: %LOGFILE% >> "%LOGFILE%"
pause
exit /b 0

:fail
echo FAILED. Check log: %LOGFILE%
echo FAILED. Check log: %LOGFILE% >> "%LOGFILE%"
pause
exit /b 1
