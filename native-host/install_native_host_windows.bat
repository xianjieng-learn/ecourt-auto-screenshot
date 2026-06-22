@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo eCourt Auto Screenshot - Windows Installer
echo ==========================================
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 install_native_host.py
  goto :after_install
)

where python >nul 2>nul
if %errorlevel%==0 (
  python install_native_host.py
  goto :after_install
)

echo ERROR: Python tidak ditemukan.
echo Install Python 3 dulu, lalu centang opsi "Add Python to PATH".
echo Setelah itu jalankan file .bat ini lagi.
echo.
pause
exit /b 1

:after_install
echo.
if %errorlevel% neq 0 (
  echo Install gagal. Cek pesan error di atas.
  echo.
  pause
  exit /b %errorlevel%
)

echo Install selesai.
echo Sekarang buka chrome://extensions lalu klik Reload pada extension ini.
echo.
pause
