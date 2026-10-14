@echo off
title TripoNext Travel App
echo ==============================================
echo    Starting TripoNext Travel App...
echo ==============================================
echo.
echo Opening app in your browser at http://localhost:3001 ...
start "" "http://localhost:3001"
echo.
echo Starting Node.js server...
node server.js
pause
