@echo off
cd /d "%~dp0"
echo ========================================================
echo Memulai ASPEND Murni (Web App Server)...
echo Buka browser Anda di: http://localhost:8000
echo ========================================================
python -m http.server 8000 --bind localhost
pause
