@echo off
chcp 65001 >nul
title DentaCare - نظام إدارة عيادات الأسنان
echo ============================================
echo   DentaCare  -  نظام ادارة عيادات الاسنان
echo ============================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
  echo [*] First run - installing dependencies... / تثبيت المكتبات لاول مرة...
  call npm install
  echo.
)

echo [*] Starting the app... / جارٍ تشغيل التطبيق...
echo [*] The browser will open at:  http://localhost:5173
echo [*] To stop: close this window. / لإيقاف التطبيق اغلق هذه النافذة
echo.

start "" http://localhost:5173
call npm run dev
pause
