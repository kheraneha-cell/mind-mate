$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4173
$prefix = "http://localhost:$port/"
$dataDirectory = Join-Path $root "data"
$dataPath = Join-Path $dataDirectory "shared-data.json"
$server = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".ico" = "image/x-icon"
}

if (-not (Test-Path $dataDirectory)) {
  New-Item -ItemType Directory -Path $dataDirectory | Out-Null
}

function New-DefaultData {
  @{ members = @(); community = @() }
}

function Read-SharedData {
  if (-not (Test-Path $dataPath)) {
    $default = New-DefaultData
    Write-SharedData $default
    return $default
  }

  $raw = Get-Content $dataPath -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    $default = New-DefaultData
    Write-SharedData $default
    return $default
  }

  return ($raw | ConvertFrom-Json -AsHashtable)
}

function Write-SharedData($data) {
  Set-Content -Path $dataPath -Value ($data | ConvertTo-Json -Depth 8) -Encoding UTF8
}

function Add-OrUpdateMember($data, $name, $email) {
  $existing = $data.members | Where-Object { $_.email -eq $email } | Select-Object -First 1
  if ($existing) {
    $existing.name = $name
    return $existing
  }

  $member = @{
    id = [guid]::NewGuid().ToString()
    name = $name
    email = $email
    connectedAt = [DateTime]::UtcNow.ToString("o")
  }
  $data.members = @($member) + @($data.members)
  return $member
}

function New-SampleCommunity($profile) {
  $now = [DateTime]::UtcNow.Date
  @(
    @{ id = "community-1"; text = "Day 3 and I noticed my thoughts slow down when I walk without my phone."; image = ""; likes = 3; loves = 1; authorName = "Nina"; authorEmail = "nina@example.com"; createdAt = $now.AddDays(-12).AddHours(19).ToString("o") },
    @{ id = "community-2"; text = "Logging honestly for 10 minutes is helping more than I expected."; image = ""; likes = 5; loves = 2; authorName = "Arjun"; authorEmail = "arjun@example.com"; createdAt = $now.AddDays(-8).AddHours(19).ToString("o") },
    @{ id = "community-3"; text = "Today I caught a repetitive worry before it took over the evening."; image = ""; likes = 7; loves = 3; authorName = "Maya"; authorEmail = "maya@example.com"; createdAt = $now.AddDays(-4).AddHours(19).ToString("o") },
    @{ id = "community-4"; text = "Small win: less scrolling, more breathing."; image = ""; likes = 9; loves = 4; authorName = "Sara"; authorEmail = "sara@example.com"; createdAt = $now.AddHours(19).ToString("o") },
    @{ id = "community-5"; text = "I am seeing my thoughts more clearly and reacting more gently."; image = ""; likes = 4; loves = 2; authorName = $profile.name; authorEmail = $profile.email; createdAt = $now.AddHours(21).ToString("o") }
  )
}

function Send-Response($client, $statusCode, $statusText, $contentType, $bytes) {
  $stream = $client.GetStream()
  $writer = [System.IO.StreamWriter]::new($stream, [System.Text.Encoding]::ASCII, 1024, $true)
  $writer.NewLine = "`r`n"
  $writer.WriteLine("HTTP/1.1 $statusCode $statusText")
  $writer.WriteLine("Content-Type: $contentType")
  $writer.WriteLine("Content-Length: $($bytes.Length)")
  $writer.WriteLine("Connection: close")
  $writer.WriteLine("Access-Control-Allow-Origin: *")
  $writer.WriteLine()
  $writer.Flush()
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush()
  $writer.Dispose()
  $client.Close()
}

function Send-Json($client, $payload, $statusCode = 200, $statusText = "OK") {
  $json = $payload | ConvertTo-Json -Depth 8
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  Send-Response $client $statusCode $statusText "application/json; charset=utf-8" $bytes
}

function Send-File($client, $path) {
  $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  $contentType = $contentTypes[$extension]
  if (-not $contentType) {
    $contentType = "application/octet-stream"
  }
  $bytes = [System.IO.File]::ReadAllBytes($path)
  Send-Response $client 200 "OK" $contentType $bytes
}

function Read-Request($client) {
  $stream = $client.GetStream()
  $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $false, 1024, $true)
  $requestLine = $reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($requestLine)) {
    $reader.Dispose()
    return $null
  }

  $parts = $requestLine.Split(" ")
  $headers = @{}
  while ($true) {
    $line = $reader.ReadLine()
    if ([string]::IsNullOrEmpty($line)) { break }
    $separator = $line.IndexOf(":")
    if ($separator -gt -1) {
      $name = $line.Substring(0, $separator).Trim()
      $value = $line.Substring($separator + 1).Trim()
      $headers[$name] = $value
    }
  }

  $body = ""
  $contentLength = 0
  if ($headers.ContainsKey("Content-Length")) {
    [int]::TryParse([string]$headers["Content-Length"], [ref]$contentLength) | Out-Null
  }
  if ($contentLength -gt 0) {
    $buffer = New-Object char[] $contentLength
    $read = 0
    while ($read -lt $contentLength) {
      $chunk = $reader.Read($buffer, $read, $contentLength - $read)
      if ($chunk -le 0) { break }
      $read += $chunk
    }
    $body = -join $buffer[0..($read - 1)]
  }

  $reader.Dispose()
  @{
    Method = $parts[0].ToUpperInvariant()
    Path = $parts[1]
    Headers = $headers
    Body = $body
  }
}

function Parse-Body($body) {
  if ([string]::IsNullOrWhiteSpace($body)) { return @{} }
  return ($body | ConvertFrom-Json -AsHashtable)
}

function Handle-ApiRequest($client, $request) {
  $data = Read-SharedData
  $method = $request.Method
  $path = $request.Path

  switch ("$method $path") {
    "GET /api/bootstrap" {
      return Send-Json $client @{ members = $data.members; community = $data.community }
    }
    "POST /api/login" {
      $body = Parse-Body $request.Body
      $name = [string]$body.name
      $email = [string]$body.email
      if ([string]::IsNullOrWhiteSpace($email)) {
        return Send-Json $client @{ error = "Email is required." } 400 "Bad Request"
      }
      if ([string]::IsNullOrWhiteSpace($name)) {
        $name = "Friend"
      }
      $member = Add-OrUpdateMember $data $name $email
      Write-SharedData $data
      return Send-Json $client @{ member = $member; members = $data.members; community = $data.community }
    }
    "GET /api/community" {
      return Send-Json $client @{ community = $data.community }
    }
    "POST /api/community" {
      $body = Parse-Body $request.Body
      if ([string]::IsNullOrWhiteSpace([string]$body.text)) {
        return Send-Json $client @{ error = "Text is required." } 400 "Bad Request"
      }
      $post = @{
        id = [guid]::NewGuid().ToString()
        text = [string]$body.text
        image = [string]$body.image
        likes = 0
        loves = 0
        authorName = [string]$body.authorName
        authorEmail = [string]$body.authorEmail
        createdAt = [DateTime]::UtcNow.ToString("o")
      }
      $data.community = @($post) + @($data.community)
      Write-SharedData $data
      return Send-Json $client @{ post = $post; community = $data.community } 201 "Created"
    }
    "POST /api/sample" {
      $body = Parse-Body $request.Body
      $profile = @{
        name = if ([string]::IsNullOrWhiteSpace([string]$body.name)) { "Demo User" } else { [string]$body.name }
        email = if ([string]::IsNullOrWhiteSpace([string]$body.email)) { "demo@mindmate.app" } else { [string]$body.email }
      }
      $data.members = @(
        @{ id = "m1"; name = "Nina"; email = "nina@example.com"; connectedAt = [DateTime]::UtcNow.ToString("o") },
        @{ id = "m2"; name = "Arjun"; email = "arjun@example.com"; connectedAt = [DateTime]::UtcNow.ToString("o") },
        @{ id = "m3"; name = "Maya"; email = "maya@example.com"; connectedAt = [DateTime]::UtcNow.ToString("o") },
        @{ id = "m4"; name = "Sara"; email = "sara@example.com"; connectedAt = [DateTime]::UtcNow.ToString("o") }
      )
      $null = Add-OrUpdateMember $data $profile.name $profile.email
      $data.community = New-SampleCommunity $profile
      Write-SharedData $data
      return Send-Json $client @{ members = $data.members; community = $data.community }
    }
  }

  if ($method -eq "POST" -and $path -match "^/api/community/(?<id>[^/]+)/reaction$") {
    $body = Parse-Body $request.Body
    $postId = $matches.id
    $type = [string]$body.type
    $post = $data.community | Where-Object { $_.id -eq $postId } | Select-Object -First 1
    if (-not $post) {
      return Send-Json $client @{ error = "Post not found." } 404 "Not Found"
    }
    switch ($type) {
      "like" { $post.likes = [int]$post.likes + 1 }
      "love" { $post.loves = [int]$post.loves + 1 }
      default { return Send-Json $client @{ error = "Unsupported reaction." } 400 "Bad Request" }
    }
    Write-SharedData $data
    return Send-Json $client @{ post = $post; community = $data.community }
  }

  return Send-Json $client @{ error = "Not found." } 404 "Not Found"
}

try {
  $server.Start()
  Write-Host "Mind Mate is running at $prefix"
  Write-Host "Press Ctrl+C to stop the server."
  Start-Process $prefix

  while ($true) {
    $client = $server.AcceptTcpClient()
    try {
      $request = Read-Request $client
      if (-not $request) {
        $client.Close()
        continue
      }

      if ($request.Path.StartsWith("/api/")) {
        Handle-ApiRequest $client $request
        continue
      }

      $trimmedPath = $request.Path.TrimStart("/")
      if ([string]::IsNullOrWhiteSpace($trimmedPath)) {
        $trimmedPath = "index.html"
      }

      $safePath = $trimmedPath.Replace("/", "\")
      $filePath = Join-Path $root $safePath

      if ((Test-Path $filePath) -and -not (Get-Item $filePath).PSIsContainer) {
        Send-File $client $filePath
      } else {
        Send-File $client (Join-Path $root "index.html")
      }
    } catch {
      $errorBytes = [System.Text.Encoding]::UTF8.GetBytes("{""error"":""$($_.Exception.Message)""}")
      Send-Response $client 500 "Internal Server Error" "application/json; charset=utf-8" $errorBytes
    }
  }
}
finally {
  $server.Stop()
}
