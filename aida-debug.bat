@echo off
echo.
echo =================================
echo      AIDA DEBUG SCRIPT
echo =================================
echo.
echo This script will help diagnose the syntax error.
echo Please press Enter to step through the script.
pause

cls
echo Step 1: Setting variables.

set "AIDA_DIR_DEBUG=%~dp0aida"
echo   - AIDA_DIR_DEBUG is: "%AIDA_DIR_DEBUG%"
pause

set "PB_EXEC_DEBUG=%AIDA_DIR_DEBUG%\pocketbase.exe"
echo   - PB_EXEC_DEBUG is: "%PB_EXEC_DEBUG%"
pause

cls
echo Step 2: Testing the 'if exist' command.
echo I will now check if the PocketBase executable exists at the path above.
echo.
pause

if exist "%PB_EXEC_DEBUG%" (
    echo. 
    echo    SUCCESS: The 'if exist' command ran without error.
    echo    RESULT: The PocketBase file was found.
    echo.
) else (
    echo.
    echo    SUCCESS: The 'if exist' command ran without error.
    echo    RESULT: The PocketBase file was NOT found.
    echo.
)
pause

cls
echo Step 3: Testing the 'if not exist' command.
echo This is the command that is likely causing the error.
echo.
pause

if not exist "%PB_EXEC_DEBUG%" (
    echo.
    echo    SUCCESS: The 'if not exist' command ran without error.
    echo    RESULT: The PocketBase file was NOT found.
    echo.
) else (
    echo.
    echo    SUCCESS: The 'if not exist' an without error.
    echo    RESULT: The PocketBase file was found.
    echo.
)
pause

cls
echo Debug script finished. Please copy all the text from this window and paste it in the chat.
pause
