@echo off
cd /d "%~dp0"
python valore_quote.py
if errorlevel 1 py valore_quote.py
if exist report_valore_quote.txt start notepad report_valore_quote.txt
pause
