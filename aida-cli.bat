@echo off
setlocal enabledelayedexpansion

:: AIDA ERP - Command Line Interface
set "SCRIPT_DIR=%~dp0"
set "PB_EXEC=%SCRIPT_DIR%pocketbase.exe"
set "PB_PORT=8090"
set "BACKEND_PORT=3001"
set "BACKEND_URL=http://localhost:3001"

:main_menu
cls
echo =================================================
echo   AIDA ERP - Command Line Interface
echo =================================================
echo.

call :check_port %PB_PORT% PB_STATUS
call :check_port %BACKEND_PORT% BACKEND_STATUS

echo   Services Status:
echo   - PocketBase:   !PB_STATUS!  (port %PB_PORT%)
echo   - AIDA Backend: !BACKEND_STATUS!  (port %BACKEND_PORT%)
echo.
echo -------------------------------------------------
echo   1. Start AIDA
echo   2. Stop AIDA
echo   3. Open in Browser
echo   4. Exit
echo -------------------------------------------------
echo.

set "CHOICE="
set /p "CHOICE=Enter your choice: "
if not defined CHOICE goto main_menu

if "%CHOICE%"=="1" goto start_services
if "%CHOICE%"=="2" goto stop_services
if "%CHOICE%"=="3" goto open_browser
if "%CHOICE%"=="4" goto exit_script

echo Invalid choice.
timeout /t 2 /nobreak >nul
goto main_menu

:: ── Start ─────────────────────────────────────────────────────────────────────
:start_services
cls
echo --- Starting AIDA ---
echo.

if not exist "%PB_EXEC%" (
    echo ERROR: pocketbase.exe not found in %SCRIPT_DIR%
    echo Run AIDA_LAUNCHER.ps1 for first-time setup.
    echo.
    pause
    goto main_menu
)

call :check_port %PB_PORT% _PB
if "!_PB!"=="Running" (
    echo PocketBase is already running.
) else (
    echo Starting PocketBase...
    start "AIDA - PocketBase" /D "%SCRIPT_DIR%" pocketbase.exe serve --dir pb_data --publicDir pb_public
)

call :check_port %BACKEND_PORT% _BACK
if "!_BACK!"=="Running" (
    echo Backend is already running.
) else (
    echo Starting Backend...
    start "AIDA - Backend" /D "%SCRIPT_DIR%" powershell.exe -NoLogo -NoExit -Command "npm run start:backend"
)

echo.
echo Waiting for services to initialize...
timeout /t 10 /nobreak >nul
goto main_menu

:: ── Stop ──────────────────────────────────────────────────────────────────────
:stop_services
cls
echo --- Stopping AIDA ---
echo.

call :check_port %BACKEND_PORT% _BACK
if "!_BACK!"=="Running" (
    for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":%BACKEND_PORT% .*LISTENING"') do (
        taskkill /T /F /PID %%p >nul 2>&1
    )
    echo Backend stopped.
) else (
    echo Backend was not running.
)

call :check_port %PB_PORT% _PB
if "!_PB!"=="Running" (
    for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":%PB_PORT% .*LISTENING"') do (
        taskkill /T /F /PID %%p >nul 2>&1
    )
    echo PocketBase stopped.
) else (
    echo PocketBase was not running.
)

echo.
pause
goto main_menu

:: ── Open Browser ──────────────────────────────────────────────────────────────
:open_browser
start "" "%BACKEND_URL%"
goto main_menu

:: ── Exit ──────────────────────────────────────────────────────────────────────
:exit_script
exit /b 0

:: ── Subroutine: check_port <port> <result_var> ────────────────────────────────
:check_port
setlocal
set "_r=Stopped"
netstat -aon 2>nul | findstr ":%~1 .*LISTENING" >nul 2>&1
if not errorlevel 1 set "_r=Running"
endlocal & set "%~2=%_r%"
goto :eof
