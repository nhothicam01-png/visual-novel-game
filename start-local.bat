@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chua tim thay Node.js. Hay cai Node.js LTS roi mo lai file nay.
  pause
  exit /b 1
)
where git >nul 2>nul
if errorlevel 1 echo Chua tim thay Git. Ung dung van chay local, nhung nut dong bo can Git.
start "" http://127.0.0.1:4173/
node local-server.js
pause
