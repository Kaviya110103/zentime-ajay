param(
  [int]$Samples = 12,
  [int]$IntervalSeconds = 5
)

for ($i = 1; $i -le $Samples; $i++) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $java = Get-Process -Name java -ErrorAction SilentlyContinue |
    Select-Object Id, CPU, @{Name="WorkingSetMB";Expression={[math]::Round($_.WorkingSet64 / 1MB, 1)}}, Path
  Write-Host "[$timestamp] Java process snapshot"
  if ($java) {
    $java | Format-Table -AutoSize
  } else {
    Write-Host "No Java process found."
  }
  Start-Sleep -Seconds $IntervalSeconds
}
