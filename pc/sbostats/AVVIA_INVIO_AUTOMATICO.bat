@echo off
cd /d "%~dp0"
py sbostats_invia.py
if errorlevel 1 pause
