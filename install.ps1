#requires -Version 5.1
<#
.SYNOPSIS
下载、校验并交互配置 Windows 发行版；服务注册由用户单独选择。
.EXAMPLE
.\install.ps1 -Version v4.1.6 -InstallDir 'D:\Apps\AWA-Helper'
.EXAMPLE
.\install.ps1 -InstallDir 'D:\Apps\AWA-Helper' -ConfigureOnly
#>
[CmdletBinding()]
param(
    [string]$Version = 'latest',
    [string]$InstallDir,
    [switch]$ConfigureOnly,
    [switch]$Help,
    # 仅供 UAC 子进程执行已由用户确认的服务注册，不重新运行配置向导。
    [ValidateSet('WinSW', 'NSSM', '')][string]$RegisterService = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Repository = 'HCLonely/AWA-Helper'
$ServiceName = 'AWAHelper'

function Read-Value([string]$Message, [string]$Default = '', [switch]$Secret) {
    if ($Secret) {
        $secure = Read-Host $Message -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        }
    } else {
        $value = Read-Host "$Message $(if ($Default) { "[$Default]" })"
    }
    if ($null -eq $value) {
        throw '输入已关闭，安装取消。'
    }
    if ($value -match '[\x00-\x1f]') {
        throw '输入不能包含控制字符。'
    }
    if ($value.Length -eq 0) {
        return $Default
    }
    return $value
}

function Confirm-Choice([string]$Message) {
    while ($true) {
        $answer = (Read-Value "$Message (y/N)" 'n').ToLowerInvariant()
        if ($answer -in @('y', 'yes')) {
            return $true
        }
        if ($answer -in @('n', 'no')) {
            return $false
        }
    }
}

function Read-Choice([string]$Message, [string[]]$Options, [string]$Default) {
    while ($true) {
        $value = Read-Value $Message $Default
        if ($value -in $Options) {
            return $value
        }
        Write-Host "请选择：$($Options -join ', ')"
    }
}

function Read-Port([string]$Message, [int]$Default) {
    while ($true) {
        $value = Read-Value $Message ([string]$Default)
        $number = 0
        if ([int]::TryParse($value, [ref]$number) -and $number -ge 1 -and $number -le 65535) {
            return $number
        }
        Write-Host '端口必须是 1–65535 的整数。'
    }
}

function Read-Required([string]$Message) {
    while ($true) {
        $value = (Read-Value $Message).Trim()
        if ($value) {
            return $value
        }
    }
}

function Write-Utf8([string]$Path, [string]$Content) {
    [IO.File]::WriteAllText($Path, $Content, (New-Object Text.UTF8Encoding($false)))
}

function Invoke-Native([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "命令执行失败：$Program（退出码 $LASTEXITCODE）"
    }
}

function Get-Release([string]$Repo, [string]$Tag) {
    $suffix = if ($Tag -eq 'latest') { 'latest' } else { "tags/$Tag" }
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/$suffix" -Headers @{
        'User-Agent' = 'AWA-Helper-Installer'
    } -TimeoutSec 60
    if ($release.draft -or $release.prerelease) {
        throw '请选择正式发行版。'
    }
    return $release
}

function Save-Download([string]$Url, [string]$Destination) {
    if (-not $Url.StartsWith('https://')) {
        throw '下载地址必须为 HTTPS。'
    }
    Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 300
}

function Save-ReleaseAsset($Release, [string]$Name, [string]$Destination) {
    $assets = @($Release.assets | Where-Object { $_.name -eq $Name })
    if ($assets.Count -ne 1) {
        throw "发行版缺少资源：$Name"
    }
    $asset = $assets[0]
    $expected = ''
    if ($asset.PSObject.Properties['digest'] -and $asset.digest -match '^sha256:([a-fA-F0-9]{64})$') {
        $expected = $Matches[1]
    } else {
        $sidecar = @($Release.assets | Where-Object { $_.name -eq "$Name.sha256" })
        if ($sidecar.Count -ne 1) {
            throw '发行版缺少 SHA-256 校验信息，拒绝安装。'
        }
        Save-Download $sidecar[0].browser_download_url "$Destination.sha256"
        $expected = ((Get-Content -LiteralPath "$Destination.sha256" -Raw) -split '\s+')[0]
    }
    if ($expected -notmatch '^[a-fA-F0-9]{64}$' -or $asset.size -le 0 -or $asset.size -gt 1GB) {
        throw '无效的发行包大小或 SHA-256 校验信息。'
    }
    Save-Download $asset.browser_download_url $Destination
    if ((Get-Item -LiteralPath $Destination).Length -ne $asset.size -or
        (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $expected) {
        throw '发行包大小或 SHA-256 校验失败；未修改安装目录。'
    }
}

function Assert-NoLink([string]$Path) {
    $current = [IO.Path]::GetFullPath($Path)
    while ($current) {
        if (Test-Path -LiteralPath $current) {
            if ((Get-Item -Force -LiteralPath $current).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "安装目标不能包含符号链接或目录联接：$current"
            }
        }
        $parent = Split-Path -Parent $current
        if ($parent -eq $current) {
            break
        }
        $current = $parent
    }
}

function Assert-Stopped([string]$Directory) {
    $lock = Join-Path $Directory 'data/manager.lock'
    if (Test-Path -LiteralPath $lock) {
        try {
            $lockData = Get-Content -LiteralPath $lock -Raw | ConvertFrom-Json
            $processId = [int]$lockData.pid
            if ($processId -le 0) {
                throw '无效 PID'
            }
        } catch {
            throw '进程锁无法识别，请确认程序已停止后检查 data/manager.lock。'
        }
        if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
            throw '此目录已有程序运行，请先停止 Helper、Manager、托盘或服务再安装。'
        }
    }
    # 托盘即使未持有 Helper 的锁，其自身可执行文件仍不可被安全替换。
    foreach ($process in @(Get-Process -Name 'AWA-Helper', 'AWA-Manager' -ErrorAction SilentlyContinue)) {
        if ($process.Path -and (Split-Path -Parent $process.Path) -eq $Directory) {
            throw '此目录已有程序或托盘运行，请先退出再安装。'
        }
    }
}

function Install-Release([string]$Directory, [string]$Tag) {
    $release = Get-Release $Repository $Tag
    $temporary = Join-Path ([IO.Path]::GetTempPath()) ('awa-install-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporary | Out-Null
    try {
        $archive = Join-Path $temporary 'release.tar.gz'
        Write-Host "正在下载并校验 $($release.tag_name)…"
        Save-ReleaseAsset $release 'AWA-Helper-Win.tar.gz' $archive
        $entries = @(& tar.exe -tzf $archive)
        if ($LASTEXITCODE -ne 0 -or $entries.Count -gt 10000) {
            throw '无法读取发行包或文件数量超限。'
        }
        $seen = @{}
        foreach ($entry in $entries) {
            $name = $entry -replace '^\./', ''
            if ($name -notmatch '^output(?:/|$)' -or $name -match '(^|/)\.\.(/|$)|[\\:\x00-\x1f]' -or $seen.ContainsKey($name)) {
                throw '发行包包含不安全或重复的路径。'
            }
            $seen[$name] = $true
        }
        $details = @(& tar.exe -tvzf $archive)
        if ($LASTEXITCODE -ne 0 -or @($details | Where-Object { $_ -notmatch '^[-d]' }).Count -gt 0) {
            throw '发行包包含链接或特殊文件。'
        }
        Invoke-Native 'tar.exe' @('-xzf', $archive, '-C', $temporary)
        $source = Join-Path $temporary 'output'
        foreach ($required in @('AWA-Helper.exe', 'AWA-Manager.exe', 'installation.json')) {
            if (-not (Test-Path -LiteralPath (Join-Path $source $required) -PathType Leaf)) {
                throw "发行包缺少 $required"
            }
        }
        $manifest = Get-Content -LiteralPath (Join-Path $source 'installation.json') -Raw | ConvertFrom-Json
        foreach ($file in $manifest.files) {
            if ($file.path -match '(^|[/\\])\.\.([/\\]|$)|^[/\\]|:' -or -not $file.path) {
                throw '文件清单包含不安全的路径。'
            }
            $path = Join-Path $source $file.path
            if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or
                (Get-Item -LiteralPath $path).Length -ne $file.size -or
                (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.sha256) {
                throw "文件清单校验失败：$($file.path)"
            }
        }
        $files = @(Get-ChildItem -LiteralPath $source -File | Where-Object { $_.Name -notin @('config.yml', 'community-event.json') })
        $example = Join-Path $source 'config/config.example.yml'
        if (Test-Path -LiteralPath $example -PathType Leaf) {
            $files += Get-Item -LiteralPath $example
        }
        foreach ($file in $files) {
            Assert-NoLink (Join-Path $Directory $file.FullName.Substring($source.Length + 1))
        }
        Assert-Stopped $Directory
        New-Item -ItemType Directory -Force -Path $Directory | Out-Null
        foreach ($file in $files) {
            $target = Join-Path $Directory $file.FullName.Substring($source.Length + 1)
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination "$target.installing" -Force
            Move-Item -LiteralPath "$target.installing" -Destination $target -Force
        }
    } finally {
        # 只清理本函数创建并验证过的随机临时目录。
        $resolved = [IO.Path]::GetFullPath($temporary)
        $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
        if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
            (Split-Path -Leaf $resolved) -match '^awa-install-[a-f0-9]{32}$') {
            Remove-Item -LiteralPath $resolved -Recurse -Force
        }
    }
}

function Set-Configuration([string]$Directory) {
    $configPath = Join-Path $Directory 'config/config.yml'
    if (Test-Path -LiteralPath (Join-Path $Directory 'config.yml')) {
        $configPath = Join-Path $Directory 'config.yml'
    }
    Assert-NoLink $configPath
    if (Test-Path -LiteralPath $configPath) {
        Write-Host "发现已有配置：$configPath"
        if (-not (Confirm-Choice '是否备份并通过向导重新配置？默认保留已有配置')) {
            return
        }
    }
    $cookie = Read-Value 'AWA Cookie（可留空，稍后通过用户脚本同步）' -Secret
    $webPort = Read-Port 'WebUI 端口' 2345
    $local = -not (Confirm-Choice '是否允许其他设备访问 WebUI？默认仅本机')
    do {
        $secret = Read-Value '管理密钥（至少16字符；留空随机生成）' -Secret
        if (-not $secret) {
            $bytes = New-Object byte[] 24
            $random = [Security.Cryptography.RandomNumberGenerator]::Create()
            try {
                $random.GetBytes($bytes)
            } finally {
                $random.Dispose()
            }
            $secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
        }
        if ($secret.Length -lt 16) {
            Write-Host '管理密钥至少需要16个字符。'
        }
    } while ($secret.Length -lt 16)
    $config = [ordered]@{
        language = 'zh'
        webUI = @{ enable = $true; port = $webPort; local = $local }
        timeout = 86400
        logsMaxMB = 512
        logsExpire = 30
        TLSRejectUnauthorized = $true
        autoUpdate = $false
        manager = @{ secret = $secret; dailyQuest = @{ cron = '3 30 14,21 * * *' } }
        awaCookie = $cookie
        awaHost = 'www.alienwarearena.com'
        awaQuests = @('getStarted', 'dailyQuest', 'timeOnSite')
        joinSteamCommunityEvent = $true
        proxy = @{ enable = @() }
    }
    Write-Host 'Manager 默认每天按系统时区在 14:30:03、21:30:03 执行每日任务，可稍后修改配置。'
    if (Confirm-Choice '是否启用 Twitch 时长任务') {
        do {
            $twitchCookie = Read-Value 'Twitch Cookie（须包含 unique_id 和 auth-token）' -Secret
        } while ($twitchCookie -notmatch '(?:^|;)\s*unique_id=[^;]+' -or $twitchCookie -notmatch '(?:^|;)\s*auth-token=[^;]+')
        $config.twitchCookie = $twitchCookie
        $config.awaQuests += 'watchTwitch'
    }
    if (Confirm-Choice '是否通过 ASF 启用 Steam 时长任务') {
        $config.steamUse = 'ASF'
        $config.asfProtocol = Read-Choice 'ASF 协议 http/https' @('http', 'https') 'http'
        $config.asfHost = Read-Required 'ASF 主机（例如127.0.0.1）'
        $config.asfPort = Read-Port 'ASF 端口' 1242
        $config.asfPassword = Read-Value 'ASF IPC 密码' -Secret
        $config.asfBotname = Read-Required 'ASF Bot 名称'
        $config.awaQuests += 'steamQuest'
    }
    if (Confirm-Choice '是否启用代理？默认关闭；启用后用于 github/twitch/awa/asf/pusher') {
        $config.proxy = @{
            enable = @('github', 'twitch', 'awa', 'asf', 'pusher')
            protocol = Read-Choice '代理协议' @('http', 'https', 'socks4', 'socks5') 'http'
            host = Read-Required '代理主机'
            port = Read-Port '代理端口' 1080
            username = Read-Value '代理用户名（可留空）'
            password = Read-Value '代理密码（可留空）' -Secret
        }
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $configPath) | Out-Null
    if (Test-Path -LiteralPath $configPath) {
        $backup = "$configPath.backup-$([guid]::NewGuid().ToString('N'))"
        Copy-Item -LiteralPath $configPath -Destination $backup
        Write-Host "原配置已备份：$backup"
    }
    Write-Utf8 "$configPath.installing" (($config | ConvertTo-Json -Depth 10) + "`n")
    Move-Item -LiteralPath "$configPath.installing" -Destination $configPath -Force
    Write-Host "配置已保存：$configPath（JSON 格式是有效的 YAML；密钥请从该文件读取）"
}

function Install-ServiceWrapper([string]$Directory, [string]$Wrapper) {
    $serviceDir = Join-Path $Directory '.service'
    Assert-NoLink $serviceDir
    New-Item -ItemType Directory -Force -Path $serviceDir | Out-Null
    if ($Wrapper -eq 'WinSW') {
        $release = Get-Release 'winsw/winsw' 'v2.12.0'
        $asset = @($release.assets | Where-Object { $_.name -eq 'WinSW-x64.exe' })
        if ($asset.Count -ne 1) {
            throw 'WinSW 发行版缺少 WinSW-x64.exe。'
        }
        # 老版 WinSW 未提供 GitHub digest；只从其官方 HTTPS Release 获取。
        $destination = Join-Path $serviceDir 'AWAHelperService.exe'
        Save-Download $asset[0].browser_download_url "$destination.downloading"
        Move-Item -LiteralPath "$destination.downloading" -Destination $destination -Force
        $content = @'
<service>
  <id>AWAHelper</id>
  <name>AWA-Helper Manager</name>
  <description>AWA-Helper persistent Manager</description>
  <executable>%BASE%\..\AWA-Helper.exe</executable>
  <arguments>--manager --no-update</arguments>
  <workingdirectory>%BASE%\..</workingdirectory>
  <startmode>Automatic</startmode>
  <stoptimeout>60sec</stoptimeout>
  <onfailure action="restart" delay="10 sec"/>
  <logpath>%BASE%\..\logs</logpath>
  <log mode="roll"/>
</service>
'@
        Write-Utf8 (Join-Path $serviceDir 'AWAHelperService.xml') $content
    } else {
        # 官网推荐现代 Windows 使用此构建，避免旧 2.24 的控制台启动问题。
        $zip = Join-Path $serviceDir 'nssm.zip'
        Save-Download 'https://nssm.cc/ci/nssm-2.24-101-g897c7ad.zip' $zip
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [IO.Compression.ZipFile]::OpenRead($zip)
        try {
            $entry = @($archive.Entries | Where-Object { $_.FullName -eq 'nssm-2.24-101-g897c7ad/win64/nssm.exe' })
            if ($entry.Count -ne 1) {
                throw 'NSSM 压缩包缺少 win64/nssm.exe。'
            }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry[0], (Join-Path $serviceDir 'nssm.exe'), $true)
        } finally {
            $archive.Dispose()
        }
    }
    return $serviceDir
}

function Register-ManagerService([string]$Directory, [string]$Wrapper) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw '服务注册需要管理员权限。'
    }
    Assert-NoLink $Directory
    Assert-Stopped $Directory
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        throw 'AWAHelper 服务已存在；请先管理或卸载原服务，未覆盖。'
    }
    $serviceDir = Join-Path $Directory '.service'
    if ($Wrapper -eq 'WinSW') {
        $program = Join-Path $serviceDir 'AWAHelperService.exe'
        Invoke-Native $program @('install')
        Invoke-Native $program @('start')
    } else {
        $program = Join-Path $serviceDir 'nssm.exe'
        Invoke-Native $program @('install', $ServiceName, (Join-Path $Directory 'AWA-Helper.exe'), '--manager', '--no-update')
        Invoke-Native $program @('set', $ServiceName, 'AppDirectory', $Directory)
        Invoke-Native $program @('set', $ServiceName, 'Start', 'SERVICE_AUTO_START')
        Invoke-Native $program @('set', $ServiceName, 'AppExit', 'Default', 'Restart')
        Invoke-Native $program @('set', $ServiceName, 'AppRestartDelay', '10000')
        Invoke-Native $program @('set', $ServiceName, 'AppStopMethodConsole', '60000')
        Invoke-Native $program @('set', $ServiceName, 'AppStdout', (Join-Path $Directory 'logs/service.log'))
        Invoke-Native $program @('set', $ServiceName, 'AppStderr', (Join-Path $Directory 'logs/service-error.log'))
        Invoke-Native $program @('set', $ServiceName, 'AppRotateFiles', '1')
        Invoke-Native $program @('start', $ServiceName)
    }
    Start-Sleep -Seconds 3
    if ((Get-Service -Name $ServiceName).Status -ne 'Running') {
        throw '服务未能保持运行，请查看安装目录中的 logs。服务文件已保留。'
    }
}

function Start-Installed([string]$Directory) {
    Write-Host '配置完成，尚未启动程序或 WebUI。'
    $mode = Read-Choice '启动方式：1=Helper 单次，2=Manager 常驻，0=暂不启动' @('0', '1', '2') '0'
    if ($mode -eq '0') {
        return
    }
    Assert-Stopped $Directory
    $executable = Join-Path $Directory 'AWA-Helper.exe'
    if ($mode -eq '1') {
        Invoke-Native $executable @('--daily', '--no-update')
        return
    }
    if (-not (Confirm-Choice '是否注册 Manager 为开机自启服务并立即启动？选否则在当前终端前台运行')) {
        Invoke-Native $executable @('--manager', '--no-update')
        return
    }
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        throw 'AWAHelper 服务已存在；请先管理或卸载原服务。'
    }
    $wrapper = Read-Choice '选择服务包装器：1=WinSW，2=NSSM，0=取消注册' @('0', '1', '2') '1'
    if ($wrapper -eq '0') {
        return
    }
    $name = if ($wrapper -eq '1') { 'WinSW' } else { 'NSSM' }
    if (-not (Confirm-Choice "是否允许从官方 HTTPS 站点自动下载并安装 $name？服务使用 LocalSystem 账户运行")) {
        Write-Host '未下载包装器，未注册或启动服务。'
        return
    }
    $serviceDir = Install-ServiceWrapper $Directory $name
    # 提权只执行服务注册。配置与凭据不进入命令行，不向其他用户发送消息。
    $copy = Join-Path $serviceDir 'install-service.ps1'
    Copy-Item -LiteralPath $PSCommandPath -Destination $copy -Force
    $escapedScript = $copy.Replace("'", "''")
    $escapedDirectory = $Directory.Replace("'", "''")
    $command = "& '$escapedScript' -InstallDir '$escapedDirectory' -RegisterService '$name'"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    Write-Host '现在请求 UAC 管理员权限，以注册并启动服务。'
    $child = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded) -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    if ($child.ExitCode -ne 0) {
        throw "服务注册或启动失败（退出码 $($child.ExitCode)）；配置已保存，请查看 logs/service-install.log。"
    }
    Write-Host '服务 AWAHelper 已注册为开机自启并启动。管理：Get-Service / Stop-Service / Start-Service AWAHelper（管理员终端）。'
}

function Main {
    if ($Help) {
        Write-Host '用法：.\install.ps1 [-Version TAG] [-InstallDir PATH] [-ConfigureOnly] [-Help]'
        return
    }
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
        throw 'Windows 发行版仅支持 x64 Windows。'
    }
    if ($Version -notmatch '^(latest|v?[0-9]+\.[0-9]+\.[0-9]+)$') {
        throw '版本应为 latest 或正式发行版 tag。'
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    if (-not $InstallDir) {
        $script:InstallDir = Read-Value '安装目录' (Join-Path $env:LOCALAPPDATA 'AWA-Helper')
    }
    $directory = [IO.Path]::GetFullPath($InstallDir)
    if ($directory -eq [IO.Path]::GetPathRoot($directory) -or $directory -match '[\x00-\x1f]') {
        throw '无效的安装目录。'
    }
    Assert-NoLink $directory
    if ($RegisterService) {
        $log = Join-Path $directory 'logs/service-install.log'
        try {
            Start-Transcript -LiteralPath $log -Append | Out-Null
            Register-ManagerService $directory $RegisterService
        } catch {
            Write-Warning "服务注册失败：$_"
            throw
        } finally {
            Stop-Transcript | Out-Null
        }
        return
    }
    if ([Console]::IsInputRedirected) {
        throw '配置向导需要交互终端；请下载脚本后在 PowerShell 中直接运行。'
    }
    Assert-Stopped $directory
    if (-not $ConfigureOnly) {
        Get-Command tar.exe -ErrorAction Stop | Out-Null
        Install-Release $directory $Version
    }
    if (-not (Test-Path -LiteralPath (Join-Path $directory 'AWA-Helper.exe') -PathType Leaf)) {
        throw '安装目录缺少 AWA-Helper.exe。'
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $directory 'logs') | Out-Null
    Set-Configuration $directory
    Start-Installed $directory
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        Main
    } catch {
        Write-Error "安装未完成：$_；已保存的配置和安装文件会保留。" -ErrorAction Continue
        exit 1
    }
}
