$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$Port = 4173
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://127.0.0.1:$Port/")
$Mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'
  '.json'='application/json; charset=utf-8'; '.txt'='text/plain; charset=utf-8'; '.md'='text/markdown; charset=utf-8'
  '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'
  '.gif'='image/gif'; '.webm'='video/webm'; '.mp4'='video/mp4'; '.mp3'='audio/mpeg'; '.wav'='audio/wav'
  '.ogg'='audio/ogg'; '.m4a'='audio/mp4'; '.srt'='text/plain; charset=utf-8'; '.woff2'='font/woff2'
}
function Send-Bytes($Response, [int]$Status, [byte[]]$Bytes, [string]$Type='application/json; charset=utf-8') {
  $Response.StatusCode = $Status
  $Response.ContentType = $Type
  $Response.Headers['Cache-Control'] = 'no-store'
  $Response.Headers['X-Content-Type-Options'] = 'nosniff'
  $Response.ContentLength64 = $Bytes.Length
  if ($script:Context.Request.HttpMethod -ne 'HEAD' -and $Bytes.Length -gt 0) { $Response.OutputStream.Write($Bytes,0,$Bytes.Length) }
}
function Send-Json($Response, [int]$Status, $Data) {
  $json = ConvertTo-Json -InputObject $Data -Depth 12 -Compress
  Send-Bytes $Response $Status ([Text.Encoding]::UTF8.GetBytes($json))
}
function Get-SafePath([string]$Relative) {
  $decoded = [Uri]::UnescapeDataString(($Relative -replace '^/+',''))
  if ($decoded -match '(^|[\\/])(\.\.?|\.git|node_modules)([\\/]|$)' -or $decoded -match '^[A-Za-z]:') { throw 'Đường dẫn không hợp lệ hoặc bị chặn.' }
  $candidate = [IO.Path]::GetFullPath((Join-Path $Root $decoded))
  if ($candidate -ne $Root -and -not $candidate.StartsWith($Root + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Đường dẫn vượt khỏi thư mục dự án.' }
  return $candidate
}
function Get-Tree([string]$Directory, [string]$Prefix='') {
  $items = @()
  foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($Directory)) {
    $name = [IO.Path]::GetFileName($entry)
    if ($name -in @('.git','node_modules','.DS_Store')) { continue }
    $relative = if ($Prefix) { "$Prefix/$name" } else { $name }
    if ([IO.Directory]::Exists($entry)) { $items += Get-Tree $entry $relative }
    elseif ([IO.File]::Exists($entry)) { $items += [pscustomobject]@{ path=$relative; type='blob'; size=([IO.FileInfo]$entry).Length } }
  }
  return $items
}
try {
  $Listener.Start()
  Write-Host ''
  Write-Host 'Visual Novel Studio LOCAL' -ForegroundColor Cyan
  Write-Host "Mo trinh duyet: http://127.0.0.1:$Port/" -ForegroundColor Green
  Write-Host 'Khong can Node.js hoac Git. Giu cua so nay mo khi su dung.'
  Write-Host 'Nhan Ctrl+C de dung may chu.'
  while ($Listener.IsListening) {
    $script:Context = $Listener.GetContext()
    $request = $script:Context.Request
    $response = $script:Context.Response
    try {
      $method = $request.HttpMethod
      $path = [Uri]::UnescapeDataString($request.Url.AbsolutePath)
      if ($method -eq 'OPTIONS') { $response.StatusCode=204; $response.Close(); continue }
      if ($path -eq '/__local__/status') { Send-Json $response 200 @{local=$true;git=$false;message='PowerShell local server'}; $response.Close(); continue }
      if ($path -eq '/__local__/tree' -and $method -eq 'GET') { $tree = @(Get-Tree $Root); Send-Json $response 200 @{tree=$tree}; $response.Close(); continue }
      if ($path.StartsWith('/__local__/contents/') -and $method -eq 'GET') {
        $relative = $path.Substring('/__local__/contents/'.Length)
        $target = Get-SafePath $relative
        if (-not (Test-Path -LiteralPath $target)) { Send-Json $response 404 @{message='Not Found'}; $response.Close(); continue }
        if (Test-Path -LiteralPath $target -PathType Container) {
          $rows = @()
          foreach ($entry in Get-ChildItem -LiteralPath $target -Force) {
            if ($entry.Name -in @('.git','node_modules','.DS_Store')) { continue }
            $p = if ($relative) { "$relative/$($entry.Name)" } else { $entry.Name }
            $rows += [pscustomobject]@{name=$entry.Name;path=$p;type=$(if($entry.PSIsContainer){'dir'}else{'file'});size=$(if($entry.PSIsContainer){0}else{$entry.Length});download_url="/$p";html_url="/$p"}
          }
          Send-Json $response 200 @($rows)
        } else {
          $info = Get-Item -LiteralPath $target
          Send-Json $response 200 @{name=$info.Name;path=$relative;type='file';size=$info.Length;download_url="/$relative";html_url="/$relative"}
        }
        $response.Close(); continue
      }
      if ($path -eq '/__local__/write' -and $method -in @('PUT','POST')) {
        $relative = $request.QueryString['path']; if (-not $relative) { throw 'Thiếu đường dẫn file.' }
        $target = Get-SafePath $relative
        $parent = [IO.Path]::GetDirectoryName($target); [IO.Directory]::CreateDirectory($parent) | Out-Null
        $stream = New-Object IO.MemoryStream
        $request.InputStream.CopyTo($stream)
        [IO.File]::WriteAllBytes($target,$stream.ToArray())
        Send-Json $response 200 @{ok=$true;path=$relative;size=$stream.Length}
        $stream.Dispose(); $response.Close(); continue
      }
      if ($path -eq '/__local__/delete' -and $method -eq 'DELETE') {
        $relative = $request.QueryString['path']; if (-not $relative) { throw 'Thiếu đường dẫn file.' }
        $target = Get-SafePath $relative
        if (Test-Path -LiteralPath $target -PathType Leaf) { Remove-Item -LiteralPath $target -Force }
        Send-Json $response 200 @{ok=$true}; $response.Close(); continue
      }
      if ($path.StartsWith('/__local__/')) { Send-Json $response 404 @{message='Không tìm thấy endpoint.'}; $response.Close(); continue }
      $relative = if ($path -eq '/') { 'index.html' } else { $path.TrimStart('/') }
      $target = Get-SafePath $relative
      if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { Send-Bytes $response 404 ([Text.Encoding]::UTF8.GetBytes('Không tìm thấy file.')) 'text/plain; charset=utf-8'; $response.Close(); continue }
      $fileInfo = Get-Item -LiteralPath $target
      $extension = [IO.Path]::GetExtension($target).ToLowerInvariant()
      $contentType = if ($Mime.ContainsKey($extension)) { $Mime[$extension] } else { 'application/octet-stream' }
      $range = $request.Headers['Range']
      if ($range -match '^bytes=(\d*)-(\d*)$') {
        $start = if ($Matches[1]) {[long]$Matches[1]} else {0L}
        $end = if ($Matches[2]) {[Math]::Min([long]$Matches[2],$fileInfo.Length-1)} else {$fileInfo.Length-1}
        if ($start -gt $end -or $start -ge $fileInfo.Length) { $response.StatusCode=416; $response.Headers['Content-Range']="bytes */$($fileInfo.Length)"; $response.Close(); continue }
        $count = [int]($end-$start+1); $buffer = New-Object byte[] $count
        $fs = [IO.File]::OpenRead($target); [void]$fs.Seek($start,[IO.SeekOrigin]::Begin); $read=0
        while ($read -lt $count) { $n=$fs.Read($buffer,$read,$count-$read); if($n -le 0){break}; $read+=$n }; $fs.Dispose()
        $response.StatusCode=206; $response.Headers['Content-Range']="bytes $start-$end/$($fileInfo.Length)"; $response.Headers['Accept-Ranges']='bytes'
        Send-Bytes $response 206 $buffer $contentType
      } else {
        $bytes = [IO.File]::ReadAllBytes($target); $response.Headers['Accept-Ranges']='bytes'
        Send-Bytes $response 200 $bytes $contentType
      }
      $response.Close()
    } catch {
      try { Send-Json $response 500 @{ok=$false;message=$_.Exception.Message}; $response.Close() } catch {}
    }
  }
} finally {
  if ($Listener.IsListening) { $Listener.Stop() }
  $Listener.Close()
}
