@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Texta Start Debug (UTF-8)

set "LOGFILE=%~dp0start_debug.log"
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
  if errorlevel 1 (
    echo WARN: db:generate failed, continue startup. >> "%LOGFILE%"
  )
)

echo Pushing DB schema... >> "%LOGFILE%"
call npm.cmd run db:push -- --skip-generate >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo WARN: db:push failed, likely network or Prisma binary issue. Continue startup. >> "%LOGFILE%"
)

echo Starting backend window... >> "%LOGFILE%"
start "Texta Backend" cmd /k "chcp 65001 >nul && cd /d %~dp0 && npm.cmd start"

echo Starting Prisma Studio window... >> "%LOGFILE%"
start "Texta Prisma Studio" cmd /k "chcp 65001 >nul && cd /d %~dp0 && npm.cmd run db:studio"

timeout /t 2 >nul
start "" "http://localhost:3000/index.html"
start "" "http://localhost:5555"

echo SUCCESS (with possible warnings). See log: %LOGFILE%
echo SUCCESS (with possible warnings). See log: %LOGFILE% >> "%LOGFILE%"
pause
exit /b 0

:fail
echo FAILED. Check log: %LOGFILE%
echo FAILED. Check log: %LOGFILE% >> "%LOGFILE%"
pause
exit /b 1

