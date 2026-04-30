$port = 8088

Start-Job -ScriptBlock {
    param($p)
    Start-Sleep 2
    Start-Process "http://localhost:$p"
} -ArgumentList $port | Out-Null

Write-Host ""
Write-Host "  iDotDot dev server" -ForegroundColor Green
Write-Host "  http://localhost:$port" -ForegroundColor Green
Write-Host "  Ctrl+C to stop" -ForegroundColor DarkGreen
Write-Host ""

npx serve -l $port .
