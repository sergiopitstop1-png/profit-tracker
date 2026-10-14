@echo off
cd /d "%~dp0"
python backtest_pronox.py
if errorlevel 1 py backtest_pronox.py
if exist report_backtest.txt start notepad report_backtest.txt
pause
