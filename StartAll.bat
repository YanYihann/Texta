@echo off
setlocal
cd /d "%~dp0"
title Texta Start All

echo ========================================
echo Texta starting...
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
  echo [2/5] Prisma client already exists. Skip generate.
) else (
  echo [2/5] Generating Prisma client...
  call npm.cmd run db:generate
  if errorlevel 1 (
    echo Prisma generate failed (network or permission issue).
    echo Try manually: npm.cmd run db:generate
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
start "Texta Backend" cmd /k "cd /d %~dp0 && npm.cmd start"

echo [5/5] Starting Prisma Studio...
start "Texta Prisma Studio" cmd /k "cd /d %~dp0 && npm.cmd run db:studio"

timeout /t 3 >nul
start "" "http://localhost:3000/index.html"
start "" "http://localhost:5555"

echo Done.
pause
endlocal
