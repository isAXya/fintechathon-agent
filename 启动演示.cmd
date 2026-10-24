@echo off
title 语行 · 银行 AI 智能体 — 演示环境
cd /d "%~dp0"

if not exist server.js (
  echo.
  echo  [错误] 没有找到 server.js
  echo  请确认本文件与 04_作品信息 文件夹在同一层。
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [错误] 没有检测到 Node.js
  echo  请先安装 Node.js 18 或以上版本 https://nodejs.org
  echo  安装完成后重新双击本文件即可。
  echo.
  pause
  exit /b 1
)

echo.
echo  语行 · 演示环境启动中
echo  浏览器将自动打开 localhost 5173
echo  关闭本窗口即停止服务。
echo.
start "" "http://localhost:5173"
node server.js
pause
