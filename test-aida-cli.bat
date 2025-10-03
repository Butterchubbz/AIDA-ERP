@echo off
setlocal enabledelayedexpansion

:: Test script for aida-cli.bat

echo Testing Choice 1: Start AIDA Services
(echo 1) | call aida-cli.bat
timeout /t 5 /nobreak >nul

echo Testing Choice 2: Stop AIDA Services
(echo 2) | call aida-cli.bat
timeout /t 5 /nobreak >nul

echo Testing Choice 3: Open AIDA in Browser
(echo 3) | call aida-cli.bat
timeout /t 5 /nobreak >nul

echo Testing Choice 4: View PocketBase Log
(echo 4) | call aida-cli.bat
timeout /t 5 /nobreak >nul

echo Testing Choice 5: View AIDA Log
(echo 5) | call aida-cli.bat
timeout /t 5 /nobreak >nul

echo Testing Choice 6: Re-run Dependency Checks
(echo 6) | call aida-cli.bat
timeout /t 5 /nobreak >nul

echo Testing Choice 7: Exit
(echo 7) | call aida-cli.bat

echo All tests completed.
pause
