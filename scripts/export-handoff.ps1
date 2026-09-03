param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $projectRoot 'outputs/handoff' }
$destinationRoot = [IO.Path]::GetFullPath($OutputDirectory)
& node (Join-Path $PSScriptRoot 'check-release.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Release checks failed; no package created.' }
$files = (& node (Join-Path $PSScriptRoot 'release-files.mjs') --json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Could not read the release file list.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$packageName = "life-backtest-team-$stamp"
$stage = Join-Path $destinationRoot $packageName
$archive = Join-Path $destinationRoot "$packageName.zip"
if ((Test-Path -LiteralPath $stage) -or (Test-Path -LiteralPath $archive)) { throw 'Destination exists; refusing to overwrite.' }
New-Item -ItemType Directory -Path $stage | Out-Null
foreach ($file in $files) {
  $source = [IO.Path]::GetFullPath((Join-Path $projectRoot $file))
  $destination = [IO.Path]::GetFullPath((Join-Path $stage $file))
  if (-not $source.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar) -or -not $destination.StartsWith($stage + [IO.Path]::DirectorySeparatorChar)) {
    throw "Invalid package path: $file"
  }
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($destination)) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
# Explicit ZIP entry names keep forward slashes on both Windows PowerShell 5.1
# and PowerShell 7; older CreateFromDirectory implementations use backslashes.
$archiveStream = [IO.File]::Open($archive, [IO.FileMode]::CreateNew)
try {
  $writer = New-Object IO.Compression.ZipArchive($archiveStream, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in $files) {
      $entryName = $file.Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($writer, (Join-Path $stage $file), $entryName, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally { $writer.Dispose() }
} finally { $archiveStream.Dispose() }
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
  if ($zip.Entries.Count -ne $files.Count) { throw 'Archive file count mismatch.' }
  foreach ($file in $files) {
    if (-not $zip.GetEntry($file)) { throw "File missing from archive: $file" }
  }
} finally { $zip.Dispose() }
Write-Output "Folder: $stage"
Write-Output "Archive: $archive"
Write-Output "SHA256: $((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash)"
