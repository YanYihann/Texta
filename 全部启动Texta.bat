@echo off
chcp 65001 >nul
title Texta 全部启动器

cd /d "%~dp0"

echo ========================================
echo Texta 全部启动中...
echo 项目目录: %cd%
echo ========================================

if not exist "node_modules" (
  echo [1/5] 未检测到 node_modules，正在安装依赖...
  call npm.cmd install
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo [2/5] 生成 Prisma Client...
call npm.cmd run db:generate
if errorlevel 1 (
  echo Prisma Client 生成失败。
  pause
  exit /b 1
)

echo [3/5] 同步数据库结构...
call npm.cmd run db:push -- --skip-generate
if errorlevel 1 (
  echo 数据库同步失败，请检查 DATABASE_URL 是否正确。
  pause
  exit /b 1
)

echo [4/5] 启动后端服务窗口...
start "Texta Backend" cmd /k "cd /d %~dp0 && npm.cmd start"

echo [5/5] 启动 Prisma Studio 窗口...
start "Texta Prisma Studio" cmd /k "cd /d %~dp0 && npm.cmd run db:studio"

timeout /t 3 >nul

echo 打开浏览器页面...
start "" "http://localhost:3000/index.html"
start "" "http://localhost:5555"

echo ========================================
echo 已启动：
echo - 后端: http://localhost:3000/index.html
echo - Prisma Studio: http://localhost:5555
echo ========================================
pause
