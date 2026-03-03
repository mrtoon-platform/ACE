@echo off
start cmd /k "cd e:\ACE\backend && node server.js"
start cmd /k "cd e:\ACE\frontend && npm run dev"
echo Both servers starting... Check separate windows.
