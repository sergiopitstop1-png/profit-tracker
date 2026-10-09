@echo off
rem Lettore Telegram Accademia. Metti questo file nella stessa cartella di accademia_reader.py
cd /d "%~dp0"
set PYTHONUTF8=1
python accademia_reader.py %*
if errorlevel 1 (
  echo.
  echo Qualcosa non ha funzionato: leggi il messaggio sopra.
  pause
)
