@echo off
setlocal
title iDotDot Dev Server
cd /d "%~dp0"

set "PORT=5173"
set "PROJECT_DIR=%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
    echo [dev] ERROR: npm was not found on PATH. Install Node.js LTS first.
    pause
    exit /b 1
)

REM --- Kill any running dev-server instances for THIS project -------------
REM Matches node processes whose command line contains both "vite" and this
REM project's directory (i.e. this project's dev server). Never touches
REM unrelated node processes.
echo [dev] Checking for running dev-server instances...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*vite*' -and $_.CommandLine -like ('*' + $env:PROJECT_DIR + '*') } | ForEach-Object { Write-Host ('[dev] Killing old dev server (PID ' + $_.ProcessId + ')'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

REM --- First run: install dependencies ------------------------------------
if not exist "node_modules\" (
    echo [dev] First run - installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [dev] ERROR: npm install failed.
        pause
        exit /b 1
    )
)

REM --- Open the browser as soon as the server is actually listening -------
echo [dev] Browser will open at http://localhost:%PORT%/ once the server is up.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$t=0; while ($t -lt 100) { if (Test-NetConnection -ComputerName localhost -Port $env:PORT -InformationLevel Quiet -WarningAction SilentlyContinue) { Start-Process ('http://localhost:' + $env:PORT + '/'); exit }; Start-Sleep -Milliseconds 300; $t++ }"

REM --- Start the dev server (foreground; Ctrl+C to stop) ------------------
call npm run dev

echo.
echo [dev] Dev server stopped.
pause
