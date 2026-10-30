@echo off
cd /d "%~dp0"
start "" http://localhost:5390
dotnet run --launch-profile http
