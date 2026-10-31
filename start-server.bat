@echo off
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python не найден. Поставьте Python или запустите в этой папке: npx serve .
  pause
  exit /b 1
)

echo Запускаю локальный сервер на http://localhost:5173
echo Чтобы остановить — закройте это окно или нажмите Ctrl+C.
start "" http://localhost:5173
python -m http.server 5173