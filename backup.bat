@echo off
:: Define source path of the database
set SOURCE_DB="C:\Users\sures\AppData\Roaming\supermart-desktop-pos\database.sqlite"

:: Define target folder where you want to keep your backups (change this to your Google Drive / USB / D: drive path)
set BACKUP_DIR="D:\SuperMart_Backups"

:: Create the target backup directory if it does not exist
if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%

:: Extract date and time in a safe file name format (YYYY-MM-DD_HHMM)
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a-%%b)
set mytime=%mytime: =0%
set BACKUP_FILE="backup_%mydate%_%mytime%.sqlite"

:: Copy the active database file safely
if exist %SOURCE_DB% (
    copy /y %SOURCE_DB% %BACKUP_DIR%\%BACKUP_FILE% >nul
    echo [SUCCESS] Database backup saved to %BACKUP_DIR%\%BACKUP_FILE%
) else (
    echo [ERROR] Live database file not found. Make sure the app has been run at least once.
)

pause
