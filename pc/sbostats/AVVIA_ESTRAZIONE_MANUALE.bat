@echo off
cd /d "%~dp0"
py estrai_sbostats.py
if errorlevel 1 pause
