Stop-Process -Name node -ErrorAction SilentlyContinue
Start-Process powershell -ArgumentList "node e:\ACE\backend\server.js"
Start-Process powershell -ArgumentList "npm run dev --prefix e:\ACE\frontend"
