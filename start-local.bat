@echo off
chcp 65001 >nul
cd /d "%~dp0"
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Windows PowerShell.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare-local.ps1"
if errorlevel 1 exit /b 1
start "Visual Novel Studio Local" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-server.ps1"
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:4173/
exit
