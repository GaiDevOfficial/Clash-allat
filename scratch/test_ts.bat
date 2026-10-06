@echo off
setlocal enabledelayedexpansion

set "TS_EXE=tailscale"
where tailscale >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\Tailscale\tailscale.exe" (
        set "TS_EXE=C:\Program Files\Tailscale\tailscale.exe"
    ) else if exist "C:\Program Files (x86)\Tailscale\tailscale.exe" (
        set "TS_EXE=C:\Program Files (x86)\Tailscale\tailscale.exe"
    )
)

set "TS_IP="
for /f "tokens=*" %%i in ('"%TS_EXE%" ip -4 2^>nul') do (
    set "TS_IP=%%i"
)

set "LAN_IP="
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -notlike '100.*' } | Select-Object -ExpandProperty IPAddress)[0]" 2^>nul') do (
    set "LAN_IP=%%i"
)

echo Tailscale IP: %TS_IP%
echo Local LAN IP: %LAN_IP%
