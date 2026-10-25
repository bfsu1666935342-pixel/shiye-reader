@echo off
chcp 65001 >nul
title 拾页 · 阅读档案
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo 没有找到 Node.js。请先安装 Node.js，或直接双击 index.html 打开。
  echo.
  pause
  exit /b 1
)

node server.mjs
pause
