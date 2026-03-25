@echo off
chcp 65001 >nul
title Texta 启动器

cd /d "%~dp0"

echo ========================================
echo Texta 本地启动中...
echo 项目目录: %cd%
echo ========================================

if not exist "node_modules" (
  echo [1/4] 未检测到 node_modules，正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo [2/4] 生成 Prisma Client...
call npm run db:generate
if errorlevel 1 (
  echo Prisma Client 生成失败。
  pause
  exit /b 1
)

echo [3/4] 同步数据库结构...
call npm run db:push -- --skip-generate
if errorlevel 1 (
  echo 数据库同步失败，请检查 DATABASE_URL 是否正确。
  pause
  exit /b 1
)

echo [4/4] 启动后端服务...
echo 启动后请访问: http://localhost:3000/index.html
echo ========================================
call npm start

pause
