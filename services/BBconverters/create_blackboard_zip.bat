@echo off
echo Creating Blackboard-compatible ZIP file...
echo.

REM Check if the required files exist
if not exist "blackboard_quiz.dat" (
    echo ERROR: blackboard_quiz.dat not found!
    echo Please run the conversion script first.
    pause
    exit /b 1
)

if not exist "imsmanifest.xml" (
    echo ERROR: imsmanifest.xml not found!
    echo Please run the conversion script first.
    pause
    exit /b 1
)

REM Create ZIP file using PowerShell (built into Windows)
echo Creating ZIP file using PowerShell...
powershell -command "Compress-Archive -Path 'blackboard_quiz.dat','imsmanifest.xml' -DestinationPath 'blackboard_import.zip' -Force"

if exist "blackboard_import.zip" (
    echo.
    echo SUCCESS: blackboard_import.zip created successfully!
    echo This file can now be imported into Blackboard.
    echo.
    echo File contents:
    echo - blackboard_quiz.dat
    echo - imsmanifest.xml
    echo.
    echo You can now upload this ZIP file to Blackboard.
) else (
    echo.
    echo ERROR: Failed to create ZIP file.
    echo.
    echo Manual ZIP creation instructions:
    echo 1. Select both files: blackboard_quiz.dat and imsmanifest.xml
    echo 2. Right-click and choose "Send to ^> Compressed (zipped) folder"
    echo 3. Rename the ZIP file to something descriptive
    echo 4. Upload the ZIP file to Blackboard
)

echo.
pause