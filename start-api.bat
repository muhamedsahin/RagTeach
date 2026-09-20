@echo off
cd /d %~dp0\apps\api
if not exist .venv (
  C:\ProgramData\anaconda3\python.exe -m venv .venv
  call .venv\Scripts\activate.bat
  pip install -r requirements.txt
) else (
  call .venv\Scripts\activate.bat
)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
