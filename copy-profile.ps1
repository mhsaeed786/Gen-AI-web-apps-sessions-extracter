$src = "C:\Users\LOQ\AppData\Local\Google\Chrome\User Data"
$dst = "C:\Users\LOQ\ai-session-extractor\.chrome-copy"

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst -Force | Out-Null
New-Item -ItemType Directory -Path "$dst\Default" -Force | Out-Null

# Copy Local State
Copy-Item "$src\Local State" "$dst\Local State" -Force
Write-Host "Copied: Local State"

# Copy essential profile files
$files = @(
    "Cookies",
    "Cookies-journal",
    "Login Data",
    "Login Data-journal",
    "Login Data For Account",
    "Login Data For Account-journal",
    "Web Data",
    "Web Data-journal",
    "Preferences",
    "Secure Preferences",
    " Favicons",
    "History",
    "History-journal"
)

foreach ($f in $files) {
    $s = Join-Path "$src\Default" $f.Trim()
    $d = Join-Path "$dst\Default" $f.Trim()
    if (Test-Path $s) {
        Copy-Item $s $d -Force
        Write-Host "Copied: Default\$($f.Trim())"
    }
}

# Copy Network folder (newer Chrome stores cookies here)
$netSrc = "$src\Default\Network"
$netDst = "$dst\Default\Network"
if (Test-Path $netSrc) {
    New-Item -ItemType Directory -Path $netDst -Force | Out-Null
    Get-ChildItem $netSrc -File | ForEach-Object {
        Copy-Item $_.FullName "$netDst\$($_.Name)" -Force
        Write-Host "Copied: Default\Network\$($_.Name)"
    }
}

Write-Host "`nDONE - Profile copied to $dst"
