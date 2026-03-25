@echo off
setlocal
chcp 65001 >nul
title Texta Start All (UTF-8)
cd /d "%~dp0"

echo ========================================
echo Texta starting in UTF-8 terminal...
echo Project: %cd%
echo ========================================

if not exist "node_modules" (
  echo [1/5] Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo Install failed.
    pause
    exit /b 1
  )
)

if exist "node_modules\.prisma\client\query_engine-windows.dll.node" (
  echo [2/5] Prisma client exists. Skip generate.
) else (
  echo [2/5] Generating Prisma client...
  call npm.cmd run db:generate
  if errorlevel 1 (
    echo Prisma generate failed.
    pause
    exit /b 1
  )
)

echo [3/5] Syncing database schema...
call npm.cmd run db:push -- --skip-generate
if errorlevel 1 (
  echo Database sync failed. Check DATABASE_URL.
  pause
  exit /b 1
)

echo [4/5] Starting backend...
start "Texta Backend" cmd /k "chcp 65001 >nul && cd /d %~dp0 && npm.cmd start"

echo [5/5] Starting Prisma Studio...
start "Texta Prisma Studio" cmd /k "chcp 65001 >nul && cd /d %~dp0 && npm.cmd run db:studio"

timeout /t 3 >nul
start "" "http://localhost:3000/index.html"
start "" "http://localhost:5555"

echo Done.
pause
endlocal
