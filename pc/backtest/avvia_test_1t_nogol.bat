@echo off
cd /d "%~dp0"
python test_1t_nogol.py
if errorlevel 1 py test_1t_nogol.py
if exist report_1t_nogol.txt start notepad report_1t_nogol.txt
pause
