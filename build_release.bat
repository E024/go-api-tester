@echo off
echo [0/4] Cleaning up old processes...
REM Force kill any running instance of api-tester.exe to prevent "file/port locked" errors
taskkill /F /IM api-tester.exe >nul 2>&1

echo [1/4] Generating Windows resources (Icon Version info)...
REM Generate resource.syso in the root directory
goversioninfo -icon=icon128.ico

if %errorlevel% neq 0 (
    echo Error: Failed to generate resources. Make sure 'icon.ico' exists.
    pause
    exit /b %errorlevel%
)

echo [2/4] Moving resources to main package...
REM CRITICAL STEP: Move the .syso file to the directory where main.go resides
REM Go build only picks up .syso files in the build target directory
move resource.syso cmd\server\ >nul

echo [3/4] Building executable...
REM -s -w: Strip debug info
REM -H=windowsgui: Hide console. (Remove this if you WANT a console window that closes the app when closed)
go build -ldflags "-s -w -H=windowsgui" -o api-tester.exe ./cmd/server

if %errorlevel% neq 0 (
    echo Error: Build failed.
    REM Clean up even if failed
    del cmd\server\resource.syso
    pause
    exit /b %errorlevel%
)

echo [4/4] Cleaning up...
REM Delete the temporary .syso file from the source directory
del cmd\server\resource.syso

echo.
echo ==========================================
echo Build Success! 
echo Output file: api-tester.exe
echo.
echo NOTE: Since this is a background app (-H=windowsgui), 
echo use Task Manager to stop it if needed.
echo ==========================================
pause