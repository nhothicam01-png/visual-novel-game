@echo off
setlocal
cd /d "%~dp0"
py -3 -m venv .venv
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
pyinstaller --noconfirm --clean --onefile --windowed --name VisualNovelExporter --collect-binaries imageio_ffmpeg --collect-data imageio_ffmpeg main.py
echo.
echo Build complete. EXE: dist\VisualNovelExporter.exe
pause
