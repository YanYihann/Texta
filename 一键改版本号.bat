@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy.MM.dd.HHmmss"') do set VER=%%i

echo ========================================
echo Texta cache version bump
echo New version: %VER%
echo ========================================

powershell -NoProfile -Command ^
  "$ver='%VER%';" ^
  "$files=@('public/index.html','public/app.html','public/pay.html','public/admin.html');" ^
  "foreach($f in $files){" ^
  "  if(Test-Path $f){" ^
  "    $c=Get-Content $f -Raw;" ^
  "    $c=$c -replace '(site-config\\.js)(\\?v=[0-9\\.]+)?','$1?v=' + $ver;" ^
  "    $c=$c -replace '(auth\\.js)(\\?v=[0-9\\.]+)?','$1?v=' + $ver;" ^
  "    $c=$c -replace '(app\\.js)(\\?v=[0-9\\.]+)?','$1?v=' + $ver;" ^
  "    $c=$c -replace '(pay\\.js)(\\?v=[0-9\\.]+)?','$1?v=' + $ver;" ^
  "    $c=$c -replace '(admin\\.js)(\\?v=[0-9\\.]+)?','$1?v=' + $ver;" ^
  "    Set-Content $f -Value $c -Encoding UTF8;" ^
  "    Write-Host ('Updated: ' + $f);" ^
  "  }" ^
  "}" ^
  "Write-Host ('Done. Version=' + $ver)"

if errorlevel 1 (
  echo Failed to bump version.
  pause
  exit /b 1
)

echo.
echo Updated successfully. Current changes:
git status --short

echo.
echo Tip: now commit and push.
pause
endlocal
