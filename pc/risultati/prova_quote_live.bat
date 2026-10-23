@echo off
rem PROVA delle quote live di API-Football: non scrive niente sul sito. Il risultato resta in quote_live_prova.txt
cd /d "%~dp0"
python prova_quote_live.py
echo.
pause
