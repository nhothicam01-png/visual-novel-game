@echo off
chcp 65001 >nul
cd /d "%~dp0"
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Windows PowerShell. Ung dung can Windows PowerShell co san tren Windows.
  pause
  exit /b 1
)
start "Visual Novel Studio Local" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-server.ps1"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:4173/
exit
