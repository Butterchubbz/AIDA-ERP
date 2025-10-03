@echo off
setlocal enabledelayedexpansion

:: AIDA Command Line Interface
:: Version 1.2.4
:: This script provides a simple menu to control the AIDA application.
:: Includes dependency checking and startup verification.

set "AIDA_DIR=%~dp0aida"
set "PB_EXEC=%AIDA_DIR%\pocketbase.exe"
set "PB_VERSION=0.21.1"
set "PB_LOG=%~dp0pocketbase.log"
set "AIDA_LOG=%~dp0aida.log"
set "PB_PORT=8090"
set "AIDA_PORT=5173"
set "AIDA_URL=http://localhost:5173/control-panel"

:main_menu
cls
echo =================================================
echo   AIDA - Command Line Interface
echo =================================================
echo.

:: Check Status
call :check_status PB_STATUS %PB_PORT%
call :check_status AIDA_STATUS %AIDA_PORT%

echo   Services Status:
echo   - PocketBase: %PB_STATUS% (Port: %PB_PORT%)
echo   - AIDA Frontend: %AIDA_STATUS% (Port: %AIDA_PORT%)
echo.

echo -------------------------------------------------

echo.

echo   MENU
echo   1. Start AIDA Services
echo   2. Stop AIDA Services
echo   3. Open AIDA in Browser
echo   4. View PocketBase Log
echo   5. View AIDA Log
echo   6. Re-run Dependency Checks
echo   7. Exit

echo.
echo -------------------------------------------------

set "CHOICE="
set /p "CHOICE=Enter your choice: "
set "CHOICE=%CHOICE: =%"

if not defined CHOICE (
    echo No choice made. Returning to menu.
    timeout /t 2 /nobreak >nul
    goto main_menu
)

if "%CHOICE%"=="1" goto start_services
if "%CHOICE%"=="2" goto stop_services
if "%CHOICE%"=="3" goto open_browser
if "%CHOICE%"=="4" goto view_pb_log
if "%CHOICE%"=="5" goto view_aida_log
if "%CHOICE%"=="6" goto check_dependencies_force
if "%CHOICE%"=="7" goto exit_script

echo Invalid choice. Please try again.
timeout /t 2 /nobreak >nul
goto main_menu

:check_dependencies_force
call :check_dependencies
goto main_menu

:check_dependencies
cls
echo Checking dependencies...

:: Check for PocketBase
if exist "%PB_EXEC%" goto check_node_modules
echo PocketBase executable not found.
set /p "DOWNLOAD_PB=Do you want to download it now (y/n)? "
if /i not "%DOWNLOAD_PB%"=="y" goto check_node_modules

echo Downloading PocketBase v%PB_VERSION%...
set "PB_URL=https://github.com/pocketbase/pocketbase/releases/download/v%PB_VERSION%/pocketbase_%PB_VERSION%_windows_amd64.zip"
set "PB_ZIP=%AIDA_DIR%\pocketbase.zip"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%PB_URL%' -OutFile '%PB_ZIP%'"
if !errorlevel! neq 0 (
    echo ERROR: Failed to download PocketBase. Please check your internet connection.
    set /p "dummy=Press any key to continue..."
    goto check_node_modules
)
echo Extracting PocketBase...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%PB_ZIP%' -DestinationPath '%AIDA_DIR%' -Force"
del "%PB_ZIP%"
echo PocketBase downloaded successfully.
set /p "dummy=Press any key to continue..."

:check_node_modules
:: Check for Node modules
if exist "%AIDA_DIR%\node_modules" goto dep_end
echo Frontend dependencies (node_modules) not found.
set /p "INSTALL_DEPS=Do you want to install them now (y/n)? "
if /i not "%INSTALL_DEPS%"=="y" goto dep_end

echo Installing frontend dependencies... This may take a few minutes.
cd /d "%AIDA_DIR%"
call npm install
if !errorlevel! neq 0 (
    echo ERROR: npm install failed. Please check for errors.
    set /p "dummy=Press any key to continue..."
) else (
    echo Dependencies installed successfully.
    set /p "dummy=Press any key to continue..."
)
cd /d "%~dp0"

:dep_end
echo Dependency check complete.
timeout /t 1 /nobreak >nul
goto :eof

:start_services
cls
echo --- Starting AIDA Services ---
if not exist "%PB_EXEC%" (
    echo PocketBase is not installed. Please run option 6 to check dependencies.
    set /p "dummy=Press any key to continue..."
    goto main_menu
)
if not exist "%AIDA_DIR%\node_modules" (
    echo Frontend dependencies are not installed. Please run option 6 to check dependencies.
    set /p "dummy=Press any key to continue..."
    goto main_menu
)

if "%PB_STATUS%"=="Running" (
    echo PocketBase is already running.
) else (
    echo Starting PocketBase...
    cd /d "%AIDA_DIR%"
    start "PocketBase_AIDA" /B pocketbase.exe serve --hooksDir=. > "%PB_LOG%" 2>&1
    cd /d "%~dp0"
)

if "%AIDA_STATUS%"=="Running" (
    echo AIDA Frontend is already running.
) else (
    echo Starting AIDA Frontend...
    cd /d "%AIDA_DIR%"
    start "AIDA_Frontend" /B npm start > "%AIDA_LOG%" 2>&1
    cd /d "%~dp0"
)

echo.
echo Waiting for services to initialize...
timeout /t 5 /nobreak >nul
goto main_menu

:stop_services
cls
echo "--- Stopping AIDA Services ---"
set "pb_pid="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PB_PORT%.*LISTENING"') do set "pb_pid=%%a"

if defined pb_pid (
    taskkill /PID %pb_pid% /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo "PocketBase (PID: %pb_pid%) stopped successfully."
    ) else (
        echo "Failed to stop PocketBase (PID: %pb_pid%)."
    )
) else (
    echo "PocketBase is already stopped."
)

set "aida_pid="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%AIDA_PORT%.*LISTENING"') do set "aida_pid=%%a"

if defined aida_pid (
    taskkill /PID %aida_pid% /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo "AIDA Frontend (PID: %aida_pid%) stopped successfully."
    ) else (
        echo "Failed to stop AIDA Frontend (PID: %aida_pid%)."
    )
) else (
    echo "AIDA Frontend is already stopped."
)

echo.
set /p "dummy=Press any key to continue..."
goto main_menu

:open_browser
cls
echo --- Opening AIDA in Browser ---
echo Opening %AIDA_URL% in your default browser...
start "" "%AIDA_URL%"
timeout /t 2 /nobreak >nul
goto main_menu

:view_pb_log
cls
echo --- PocketBase Log ---
if exist "%PB_LOG%" (
    type "%PB_LOG%"
) else (
    echo Log file not found.
)
echo ----------------------
echo.
set /p "dummy=Press any key to continue..."
goto main_menu

:view_aida_log
cls
echo --- AIDA Log ---
if exist "%AIDA_LOG%" (
    type "%AIDA_LOG%"
) else (
    echo Log file not found.
)
echo ------------------
echo.
set /p "dummy=Press any key to continue..."
goto main_menu

:check_status
setlocal
set "status_var=%~1"
set "port=%~2"
netstat -aon | findstr ":%port%.*LISTENING" >NUL
if "!errorlevel!"=="0" (
    endlocal & set "%status_var%=Running"
) else (
    endlocal & set "%status_var%=Stopped"
)
goto :eof

:exit_script
cls
echo AIDA CLI has been terminated.
set /p "dummy=Press any key to continue..."
goto :eof
