#!/bin/sh
# shellcheck shell=bash
# POSIX sh 引导段：在解析后面的 Bash 语法前，自动准备 Bash 4+ 并重新执行。
if [ -z "${BASH_VERSION:-}" ] || ! bash -c 'test "${BASH_VERSINFO[0]}" -ge 4' 2>/dev/null; then
    set -e
    case ${1:-} in
        --help|-h)
            printf '%s\n' '用法：sh install.sh [--version TAG] [--install-dir PATH] [--configure-only]' \
                '自动尝试安装缺少的 Bash、curl、jq 等工具；glibc 缺失时单独询问。'
            exit 0
            ;;
    esac
    if ! command -v bash >/dev/null 2>&1 || ! bash -c 'test "${BASH_VERSINFO[0]}" -ge 4'; then
        printf '%s\n' '缺少 Bash 4+，正在通过系统包管理器自动尝试安装；可能要求 sudo 验证。' >&2
        _awa_boot_root() {
            if [ "$(id -u)" -eq 0 ]; then
                "$@"
            elif command -v sudo >/dev/null 2>&1; then
                sudo -- "$@"
            else
                printf '%s\n' '自动安装 Bash 需要 root 或 sudo，请安装 Bash 后重试。' >&2
                exit 1
            fi
        }
        if command -v apt-get >/dev/null 2>&1; then
            _awa_boot_root apt-get update
            _awa_boot_root apt-get install -y --no-install-recommends bash
        elif command -v dnf >/dev/null 2>&1; then
            _awa_boot_root dnf install -y bash
        elif command -v yum >/dev/null 2>&1; then
            _awa_boot_root yum install -y bash
        elif command -v zypper >/dev/null 2>&1; then
            _awa_boot_root zypper --non-interactive install bash
        elif command -v pacman >/dev/null 2>&1; then
            _awa_boot_root pacman -S --needed --noconfirm bash
        elif command -v apk >/dev/null 2>&1; then
            _awa_boot_root apk add bash
        else
            printf '%s\n' '没有支持的官方包管理器，请手动安装 Bash 4+ 后重试。' >&2
            exit 1
        fi
        if ! command -v bash >/dev/null 2>&1 || ! bash -c 'test "${BASH_VERSINFO[0]}" -ge 4'; then
            printf '%s\n' '自动安装后仍缺少 Bash 4+，请检查系统。' >&2
            exit 1
        fi
    fi
    exec bash "$0" "$@"
fi

# Linux 一键安装与配置，不需要 Python 或 Node.js。
# 用法：sh install.sh [--version TAG] [--install-dir PATH] [--configure-only]
# 工具缺失时自动尝试通过官方包管理器安装；glibc 缺失时仍单独询问。
set +x
set -Eeuo pipefail

REPOSITORY='HCLonely/AWA-Helper'
SERVICE='awa-helper'
VERSION='latest'
INSTALL_DIR=''
CONFIGURE_ONLY=false
WORK_DIR=''
REPLY=''
CLEANUP_FILES=()

log() {
    printf '%s\n' "$*" >&2
}

die() {
    log "$*"
    exit 1
}

# 使用独立终端描述符，避免重定向或下载命令占用配置输入；凭据不回显。
ask() {
    local message=$1 default=${2:-} secret=${3:-false}
    printf '%s' "$message" >&3
    if [[ -n $default ]]; then
        printf ' [%s]' "$default" >&3
    fi
    printf ': ' >&3
    if [[ $secret == true ]]; then
        if ! IFS= read -r -s REPLY <&3; then
            printf '\n' >&3
            die '输入已关闭，安装取消。'
        fi
        printf '\n' >&3
    elif ! IFS= read -r REPLY <&3; then
        die '输入已关闭，安装取消。'
    fi
    if [[ $REPLY =~ [[:cntrl:]] ]]; then
        die '输入不能包含控制字符。'
    fi
    REPLY=${REPLY:-$default}
}

yes() {
    while true; do
        ask "$1 (y/N)" n
        case ${REPLY,,} in
            y|yes) return 0 ;;
            n|no) return 1 ;;
        esac
    done
}

read_choice() {
    local message=$1 default=$2 option
    shift 2
    while true; do
        ask "$message" "$default"
        for option in "$@"; do
            if [[ $REPLY == "$option" ]]; then
                return 0
            fi
        done
        log "请选择：$*"
    done
}

read_port() {
    while true; do
        ask "$1" "$2"
        if [[ $REPLY =~ ^[0-9]{1,5}$ ]] && ((10#$REPLY >= 1 && 10#$REPLY <= 65535)); then
            REPLY=$((10#$REPLY))
            return 0
        fi
        log '端口必须是 1–65535 的整数。'
    done
}

read_required() {
    while true; do
        ask "$1"
        if [[ $REPLY =~ [^[:space:]] ]]; then
            return 0
        fi
    done
}

as_root() {
    if ((EUID == 0)); then
        "$@"
    elif command -v sudo >/dev/null 2>&1; then
        sudo -- "$@"
    else
        die '此操作需要 root 或 sudo；尚未执行安装命令。'
    fi
}

package_manager() {
    local manager
    for manager in apt-get dnf yum zypper pacman apk; do
        if command -v "$manager" >/dev/null 2>&1; then
            printf '%s' "$manager"
            return 0
        fi
    done
    return 1
}

# 不修改软件源、不添加第三方密钥、不编译或替换系统 libc。
install_packages() {
    local manager=$1
    shift
    case $manager in
        apt-get)
            as_root apt-get update
            as_root apt-get install -y --no-install-recommends "$@"
            ;;
        dnf|yum) as_root "$manager" install -y "$@" ;;
        zypper) as_root zypper --non-interactive install "$@" ;;
        pacman) as_root pacman -S --needed --noconfirm "$@" ;;
        apk) as_root apk add "$@" ;;
        *) die '无法识别官方包管理器，请手动安装依赖后重试。' ;;
    esac
}

# 检测真实的 GNU libc；musl 的 gcompat/libc6-compat 不视为 glibc。
has_glibc() {
    local output loader
    output=$(getconf GNU_LIBC_VERSION 2>/dev/null || true)
    if [[ $output == glibc\ * ]]; then
        return 0
    fi
    output=$(ldd --version 2>&1 || true)
    if [[ ${output,,} == *glibc* || ${output,,} == *'gnu libc'* || ${output,,} == *'gnu c library'* ]]; then
        return 0
    fi
    for loader in /lib64/ld-linux-x86-64.so.2 /lib/ld-linux-aarch64.so.1 /lib/ld-linux-armhf.so.3; do
        if [[ -x $loader ]]; then
            output=$("$loader" --version 2>&1 || true)
            if [[ ${output,,} == *glibc* || ${output,,} == *'gnu libc'* || ${output,,} == *'gnu c library'* ]]; then
                return 0
            fi
        fi
    done
    return 1
}

ensure_glibc() {
    local manager package
    if has_glibc; then
        return 0
    fi
    if ! yes '未检测到 glibc，是否通过发行版官方包管理器自动安装'; then
        die '已取消 glibc 安装；准备好 glibc 后可重新运行脚本。'
    fi
    manager=$(package_manager) || die '没有支持的官方包管理器，请手动准备真正的 glibc 后重试。'
    case $manager in
        apt-get) package=libc6 ;;
        dnf|yum|zypper|pacman) package=glibc ;;
        apk) die 'Alpine/musl 官方兼容层不等于 glibc。不会添加第三方源；请手动准备真正的 glibc，或使用受支持的 glibc 系统。' ;;
        *) die '此发行版无法自动安装真正的 glibc，请手动安装后重试。' ;;
    esac
    log "将通过 $manager 安装 $package；可能要求 sudo 验证。"
    install_packages "$manager" "$package"
    if ! has_glibc; then
        die '安装完成后仍未检测到真正的 glibc，请手动检查系统；未下载或启动程序。'
    fi
}

ensure_tools() {
    local tool manager
    local missing=() packages=()
    for tool in curl jq tar gzip sha256sum stat od realpath mktemp install cp mv chmod mkdir dirname id uname sleep; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            missing+=("$tool")
        fi
    done
    if ((${#missing[@]} == 0)); then
        return 0
    fi
    log "缺少工具：${missing[*]}"
    log '正在通过官方包管理器自动尝试安装所需工具；可能要求 sudo 验证。'
    manager=$(package_manager) || die '无法识别官方包管理器，请手动安装所需工具。'
    packages=(curl jq tar gzip coreutils ca-certificates)
    install_packages "$manager" "${packages[@]}"
    for tool in "${missing[@]}"; do
        command -v "$tool" >/dev/null 2>&1 || die "仍缺少 $tool，请手动安装后重试。"
    done
}

# 仅删除本次 mktemp 创建的目录与配置临时文件，不接触用户原有数据。
cleanup() {
    local path
    for path in "${CLEANUP_FILES[@]}"; do
        if [[ ${path##*/} == .awa-config.* ]]; then
            rm -f -- "$path"
        fi
    done
    if [[ -n $WORK_DIR && -d $WORK_DIR && ! -L $WORK_DIR && ${WORK_DIR##*/} == awa-install.* ]]; then
        rm -rf -- "$WORK_DIR"
    fi
}

assert_no_link() {
    local path=$1
    while [[ $path != / && -n $path ]]; do
        [[ ! -L $path ]] || die "安装路径不能包含符号链接：$path"
        path=${path%/*}
    done
}

check_stopped() {
    local pid lock="$1/data/manager.lock"
    if [[ -f $lock ]]; then
        pid=$(jq -er '.pid | select(type == "number" and . > 0 and floor == .)' "$lock") || die '进程锁无法识别，请确认程序已停止后检查 data/manager.lock。'
        if kill -0 "$pid" 2>/dev/null || [[ -d /proc/$pid ]]; then
            die '此目录已有程序运行，请先停止 Helper、Manager 或服务再继续。'
        fi
    fi
}

# 限制 HTTPS、超时与最大下载大小；网络错误直接退出，不执行未完整下载的内容。
fetch() {
    local url=$1 destination=$2 limit=${3:-1048576}
    [[ $url == https://* ]] || die '下载地址必须为 HTTPS。'
    curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
        --retry 2 --connect-timeout 15 --max-time 300 --max-filesize "$limit" \
        -H 'User-Agent: AWA-Helper-Installer' "$url" -o "$destination"
}

# 先检查全部成员，再解压；拒绝路径穿越、重复成员、链接及设备文件。
validate_archive() {
    local archive=$1 name normalized line permission field2 field3 _field4 field5 rest size
    local total=0 count=0
    local -A seen=()
    tar -tzf "$archive" > "$WORK_DIR/names.txt"
    while IFS= read -r name; do
        normalized=${name#./}
        normalized=${normalized%/}
        if [[ ! $normalized =~ ^output(/[A-Za-z0-9_./-]+)?$ || $normalized =~ (^|/)\.\.(/|$) ]]; then
            die '发行包包含不安全的路径。'
        fi
        [[ -z ${seen[$normalized]+present} ]] || die '发行包包含重复路径。'
        seen[$normalized]=1
        count=$((count + 1))
        ((count <= 10000)) || die '发行包文件数量超出限制。'
    done < "$WORK_DIR/names.txt"
    ((count > 0)) || die '发行包为空。'
    LC_ALL=C tar -tvzf "$archive" > "$WORK_DIR/details.txt"
    while IFS= read -r line; do
        read -r permission field2 field3 _field4 field5 rest <<< "$line"
        case $permission in
            -*) ;;
            d*) ;;
            *) die '发行包包含链接或特殊文件。' ;;
        esac
        if [[ $field2 == */* ]]; then
            size=$field3
        elif [[ $field2 =~ ^[0-9]+$ ]]; then
            size=$field5
        else
            die '无法识别 tar 文件列表格式，未解压发行包。'
        fi
        [[ $size =~ ^[0-9]{1,10}$ ]] || die '无效的归档成员大小。'
        total=$((total + 10#$size))
        ((total <= 2147483648)) || die '发行包解压大小超出限制。'
    done < "$WORK_DIR/details.txt"
}

install_release() {
    local directory=$1 version=$2 architecture suffix asset_name asset_url asset_size expected actual tag source target file
    case $(uname -m) in
        x86_64) architecture=x64 ;;
        aarch64|arm64) architecture=armv8 ;;
        armv7l) architecture=armv7 ;;
        *) die '不支持此 CPU 架构；支持 x64、armv7 和 arm64。' ;;
    esac
    suffix=latest
    if [[ $version != latest ]]; then
        suffix="tags/$version"
    fi
    fetch "https://api.github.com/repos/$REPOSITORY/releases/$suffix" "$WORK_DIR/release.json"
    jq -e '.draft == false and .prerelease == false and (.tag_name | type == "string") and (.assets | type == "array")' "$WORK_DIR/release.json" >/dev/null
    tag=$(jq -er '.tag_name' "$WORK_DIR/release.json")
    asset_name="AWA-Helper-Linux-$architecture.tar.gz"
    jq -ce --arg name "$asset_name" '[.assets[] | select(.name == $name)] | if length == 1 then .[0] else error("Release asset missing or duplicated") end' \
        "$WORK_DIR/release.json" > "$WORK_DIR/asset.json"
    asset_url=$(jq -er '.browser_download_url | select(type == "string")' "$WORK_DIR/asset.json")
    asset_size=$(jq -er '.size | select(type == "number" and floor == . and . > 0 and . <= 1073741824)' "$WORK_DIR/asset.json")
    expected=$(jq -r '.digest // "" | sub("^sha256:"; "")' "$WORK_DIR/asset.json")
    if [[ ! $expected =~ ^[a-fA-F0-9]{64}$ ]]; then
        local checksum_url
        checksum_url=$(jq -er --arg name "$asset_name.sha256" '[.assets[] | select(.name == $name)] | if length == 1 then .[0].browser_download_url else error("SHA-256 checksum missing") end' "$WORK_DIR/release.json")
        fetch "$checksum_url" "$WORK_DIR/release.sha256" 4096
        read -r expected rest < "$WORK_DIR/release.sha256"
    fi
    [[ $expected =~ ^[a-fA-F0-9]{64}$ ]] || die '发行版缺少有效的 SHA-256 校验信息，拒绝安装。'
    log "正在下载并校验 $tag / $architecture…"
    fetch "$asset_url" "$WORK_DIR/release.tar.gz" "$asset_size"
    [[ $(stat -c %s "$WORK_DIR/release.tar.gz") == "$asset_size" ]] || die '发行包大小校验失败，未修改安装目录。'
    read -r actual rest < <(sha256sum "$WORK_DIR/release.tar.gz")
    [[ $actual == "${expected,,}" ]] || die '发行包 SHA-256 校验失败，未修改安装目录。'
    validate_archive "$WORK_DIR/release.tar.gz"
    mkdir -p "$WORK_DIR/files"
    tar -xzf "$WORK_DIR/release.tar.gz" -C "$WORK_DIR/files"
    source="$WORK_DIR/files/output"
    [[ -f $source/AWA-Helper ]] || die '发行包缺少 AWA-Helper。'
    chmod 755 "$source/AWA-Helper"
    if ! "$source/AWA-Helper" --version > "$WORK_DIR/runtime-check.log" 2>&1; then
        die '发行包无法在此系统运行。glibc 可能过旧，或缺少其他运行库；请检查系统兼容性，未替换已安装程序。'
    fi
    local files=(AWA-Helper AWA-Manager.sh AWA-DailyQuest.sh update.sh README.html README_en.html healthcheck.js index.js installation.json THIRD-PARTY-NOTICES.txt install.sh config/config.example.yml)
    for file in "${files[@]}"; do
        if [[ -f $source/$file ]]; then
            assert_no_link "$directory/$file"
            assert_no_link "$directory/$file.installing"
        fi
    done
    check_stopped "$directory"
    mkdir -p "$directory"
    for file in "${files[@]}"; do
        [[ -f $source/$file ]] || continue
        target="$directory/$file"
        mkdir -p "$(dirname "$target")"
        cp -- "$source/$file" "$target.installing"
        case $file in
            AWA-Helper|*.sh) chmod 755 "$target.installing" ;;
            *) chmod 644 "$target.installing" ;;
        esac
        mv -f -- "$target.installing" "$target"
    done
}

# JSON 是有效的 YAML；通过标准输入进行字符串转义，凭据不进入进程参数。
json_string() {
    printf '%s' "$1" | jq -Rs .
}

configure() {
    local directory=$1 config_path="$1/config/config.yml" temporary backup
    local cookie web_port local_only=true secret twitch_cookie='' twitch_task='' steam_task=''
    local asf_protocol=http asf_host='' asf_port=1242 asf_password='' asf_bot=''
    local proxy_targets='[]' proxy_protocol=http proxy_host='' proxy_port=1080 proxy_user='' proxy_password=''
    if [[ -e $directory/config.yml || -L $directory/config.yml ]]; then
        config_path="$directory/config.yml"
    fi
    assert_no_link "$config_path"
    if [[ -e $config_path ]]; then
        log "发现已有配置：$config_path"
        if ! yes '是否备份并通过向导重新配置？默认保留已有配置'; then
            return 0
        fi
    fi
    ask 'AWA Cookie（可留空，稍后通过用户脚本同步）' '' true
    cookie=$REPLY
    read_port 'WebUI 端口' 2345
    web_port=$REPLY
    if yes '是否允许其他设备访问 WebUI？默认仅本机'; then
        local_only=false
    fi
    while true; do
        ask '管理密钥（至少16字符；留空随机生成）' '' true
        secret=$REPLY
        if [[ -z $secret ]]; then
            # 每次恰好读取24字节，不使用会被 pipefail/SIGPIPE 中断的 head 管道。
            secret=$(od -An -N24 -tx1 /dev/urandom)
            secret=${secret//[[:space:]]/}
        fi
        ((${#secret} >= 16)) && break
        log '管理密钥至少需要16个字符。'
    done
    log 'Manager 默认每天按系统时区在 14:30:03、21:30:03 执行每日任务，可稍后修改配置。'
    if yes '是否启用 Twitch 时长任务'; then
        while true; do
            ask 'Twitch Cookie（须包含 unique_id 和 auth-token）' '' true
            twitch_cookie=$REPLY
            if [[ $twitch_cookie =~ (^|\;)[[:space:]]*unique_id=[^\;]+ && $twitch_cookie =~ (^|\;)[[:space:]]*auth-token=[^\;]+ ]]; then
                break
            fi
            log 'Cookie 缺少 unique_id 或 auth-token。'
        done
        twitch_task=', "watchTwitch"'
    fi
    if yes '是否通过 ASF 启用 Steam 时长任务'; then
        read_choice 'ASF 协议 http/https' http http https
        asf_protocol=$REPLY
        read_required 'ASF 主机（例如127.0.0.1）'
        asf_host=$REPLY
        read_port 'ASF 端口' 1242
        asf_port=$REPLY
        ask 'ASF IPC 密码' '' true
        asf_password=$REPLY
        read_required 'ASF Bot 名称'
        asf_bot=$REPLY
        steam_task=', "steamQuest"'
    fi
    if yes '是否启用代理？默认关闭；启用后用于 github/twitch/awa/asf/pusher'; then
        proxy_targets='["github", "twitch", "awa", "asf", "pusher"]'
        read_choice '代理协议' http http https socks4 socks5
        proxy_protocol=$REPLY
        read_required '代理主机'
        proxy_host=$REPLY
        read_port '代理端口' 1080
        proxy_port=$REPLY
        ask '代理用户名（可留空）'
        proxy_user=$REPLY
        ask '代理密码（可留空）' '' true
        proxy_password=$REPLY
    fi
    mkdir -p "$(dirname "$config_path")"
    temporary=$(mktemp "$(dirname "$config_path")/.awa-config.XXXXXXXX")
    CLEANUP_FILES+=("$temporary")
    cat > "$temporary" <<JSON
{
  "language": "zh",
  "webUI": {"enable": true, "port": $web_port, "local": $local_only},
  "timeout": 86400, "logsMaxMB": 512, "logsExpire": 30,
  "TLSRejectUnauthorized": true, "autoUpdate": false,
  "manager": {"secret": $(json_string "$secret"), "dailyQuest": {"cron": "3 30 14,21 * * *"}},
  "awaCookie": $(json_string "$cookie"), "awaHost": "www.alienwarearena.com",
  "awaQuests": ["getStarted", "dailyQuest", "timeOnSite"$twitch_task$steam_task],
  "joinSteamCommunityEvent": true,
  "twitchCookie": $(json_string "$twitch_cookie"),
  "steamUse": "ASF", "asfProtocol": $(json_string "$asf_protocol"),
  "asfHost": $(json_string "$asf_host"), "asfPort": $asf_port,
  "asfPassword": $(json_string "$asf_password"), "asfBotname": $(json_string "$asf_bot"),
  "proxy": {"enable": $proxy_targets, "protocol": $(json_string "$proxy_protocol"),
    "host": $(json_string "$proxy_host"), "port": $proxy_port,
    "username": $(json_string "$proxy_user"), "password": $(json_string "$proxy_password")}
}
JSON
    jq -e . "$temporary" >/dev/null
    if [[ -e $config_path ]]; then
        backup=$(mktemp "$config_path.backup.XXXXXXXX")
        cp -- "$config_path" "$backup"
        chmod 600 "$backup"
        log "原配置已备份：$backup"
    fi
    chmod 600 "$temporary"
    mv -f -- "$temporary" "$config_path"
    log "配置已保存：$config_path（JSON 格式是有效的 YAML；密钥请从该文件读取）"
}

shell_quote() {
    printf "'%s'" "${1//\'/\'\\\'\'}"
}

detect_service() {
    if [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
        printf systemd
    elif [[ -e /run/openrc ]] && command -v rc-service >/dev/null 2>&1 && command -v rc-update >/dev/null 2>&1; then
        printf openrc
    elif [[ -d /etc/init.d && $(</proc/1/comm) =~ ^(init|sysvinit)$ ]] && command -v start-stop-daemon >/dev/null 2>&1 && { command -v update-rc.d >/dev/null 2>&1 || command -v chkconfig >/dev/null 2>&1; }; then
        printf sysv
    else
        printf nohup
    fi
}

service_file() {
    local kind=$1 directory=$2 username=$3 escaped working
    if [[ $kind == systemd ]]; then
        escaped=${directory//\\/\\\\}
        escaped=${escaped//\"/\\\"}
        escaped=${escaped//%/%%}
        escaped=${escaped//\$/\$\$}
        working=${directory//%/%%}
        cat <<UNIT
[Unit]
Description=AWA-Helper Manager
Wants=network-online.target
After=network-online.target
[Service]
Type=simple
User=$username
WorkingDirectory=$working
ExecStart=/bin/sh -c 'exec "\$\$@"' -- "$escaped/AWA-Helper" --manager --no-update
Restart=on-failure
RestartSec=10
TimeoutStopSec=60
UMask=0077
[Install]
WantedBy=multi-user.target
UNIT
    elif [[ $kind == openrc ]]; then
        cat <<OPENRC
#!/sbin/openrc-run
description="AWA-Helper Manager"
command=$(shell_quote "$directory/AWA-Helper")
command_args="--manager --no-update"
command_user=$(shell_quote "$username")
directory=$(shell_quote "$directory")
command_background=true
pidfile="/run/awa-helper.pid"
output_log=$(shell_quote "$directory/logs/service.log")
error_log=$(shell_quote "$directory/logs/service-error.log")
retry="TERM/60/KILL/5"
depend() {
    need net
}
OPENRC
    else
        cat <<SYSV
#!/bin/sh
### BEGIN INIT INFO
# Provides:          awa-helper
# Required-Start:    \$remote_fs \$network
# Required-Stop:     \$remote_fs \$network
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: AWA-Helper Manager
### END INIT INFO
command=$(shell_quote "$directory/AWA-Helper")
directory=$(shell_quote "$directory")
user=$(shell_quote "$username")
pidfile=/run/awa-helper.pid
case "\$1" in
    start)
        start-stop-daemon --start --quiet --oknodo --background --make-pidfile \\
            --pidfile "\$pidfile" --exec "\$command" --chuid "\$user" \\
            --chdir "\$directory" -- --manager --no-update
        ;;
    stop)
        start-stop-daemon --stop --quiet --oknodo --pidfile "\$pidfile" \\
            --exec "\$command" --retry TERM/60/KILL/5
        ;;
    restart)
        "\$0" stop && "\$0" start
        ;;
    status)
        start-stop-daemon --status --pidfile "\$pidfile" --exec "\$command"
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart|status}" >&2
        exit 2
        ;;
esac
SYSV
    fi
}

register_service() {
    local directory=$1 kind=$2 username target source mode
    username=$(id -un)
    if [[ $kind == systemd ]]; then
        target=/etc/systemd/system/awa-helper.service
        mode=644
    else
        target=/etc/init.d/awa-helper
        mode=755
    fi
    [[ ! -e $target && ! -L $target ]] || die "服务文件已存在：$target；未覆盖，请先管理或卸载原服务。"
    assert_no_link "$directory/.service"
    mkdir -p "$directory/.service"
    source="$directory/.service/${target##*/}"
    assert_no_link "$source"
    service_file "$kind" "$directory" "$username" > "$source"
    chmod "$mode" "$source"
    log "注册 $kind 系统服务，以 $username 运行；现在可能要求 sudo 验证。"
    as_root install -m "$mode" "$source" "$target"
    case $kind in
        systemd)
            as_root systemctl daemon-reload
            as_root systemctl enable --now "$SERVICE"
            sleep 2
            as_root systemctl is-active --quiet "$SERVICE"
            log '管理：sudo systemctl {status|stop|start|restart} awa-helper；日志：journalctl -u awa-helper'
            ;;
        openrc)
            as_root rc-update add "$SERVICE" default
            as_root rc-service "$SERVICE" start
            sleep 2
            as_root rc-service "$SERVICE" status
            log '管理：sudo rc-service awa-helper {status|stop|start|restart}'
            ;;
        sysv)
            if command -v update-rc.d >/dev/null 2>&1; then
                as_root update-rc.d "$SERVICE" defaults
            else
                as_root chkconfig --add "$SERVICE"
                as_root chkconfig "$SERVICE" on
            fi
            as_root "$target" start
            sleep 2
            as_root "$target" status
            log '管理：sudo /etc/init.d/awa-helper {status|stop|start|restart}'
            ;;
    esac
    log '服务已注册为开机自启并启动；配置 autoUpdate 默认关闭，请停服务后更新。'
}

start_installed() {
    local directory=$1 mode kind pid
    log '配置完成，尚未启动程序或 WebUI。'
    read_choice '启动方式：1=Helper 单次，2=Manager 常驻，0=暂不启动' 0 0 1 2
    mode=$REPLY
    [[ $mode != 0 ]] || return 0
    check_stopped "$directory"
    if [[ $mode == 1 ]]; then
        "$directory/AWA-Helper" --daily --no-update
    elif ! yes '是否注册 Manager 为开机自启服务并立即启动？选否则在当前终端前台运行'; then
        "$directory/AWA-Helper" --manager --no-update
    else
        kind=$(detect_service)
        if [[ $kind != nohup ]]; then
            register_service "$directory" "$kind"
        elif yes '未发现可用 init 系统。是否改用 nohup 后台运行？此方式不能保证开机自启'; then
            command -v nohup >/dev/null 2>&1 || die '系统缺少 nohup。'
            nohup "$directory/AWA-Helper" --manager --no-update </dev/null >> "$directory/logs/service.log" 2>&1 &
            pid=$!
            sleep 2
            kill -0 "$pid" 2>/dev/null || die '后台启动失败，请查看 logs/service.log。'
            log "后台 PID：$pid；停止：kill -TERM $pid；日志：$directory/logs/service.log"
        fi
    fi
}

main() {
    while (($#)); do
        case $1 in
            --help|-h)
                printf '%s\n' '用法：bash install.sh [--version TAG] [--install-dir PATH] [--configure-only]' \
                    '需要 Linux、Bash 4+、glibc、curl、jq、tar/gzip 和 coreutils；不依赖 Python 或 Node.js。' \
                    '缺少工具时自动尝试通过官方包管理器安装；glibc 缺失时单独询问。'
                return 0
                ;;
            --version|--install-dir)
                if (($# < 2)); then
                    die "$1 缺少参数。"
                fi
                [[ -n $2 ]] || die "$1 缺少参数。"
                if [[ $1 == --version ]]; then
                    VERSION=$2
                else
                    INSTALL_DIR=$2
                fi
                shift 2
                ;;
            --configure-only)
                CONFIGURE_ONLY=true
                shift
                ;;
            *) die "未知参数：$1（使用 --help 查看用法）" ;;
        esac
    done
    [[ $OSTYPE == linux* ]] || die '此脚本仅支持 Linux；Windows 请使用 install.ps1。'
    ((BASH_VERSINFO[0] >= 4)) || die '需要 Bash 4 或更高版本。'
    [[ $VERSION =~ ^(latest|v?[0-9]+\.[0-9]+\.[0-9]+)$ ]] || die '版本应为 latest 或正式发行版 tag。'
    exec 3<>/dev/tty || die '配置向导需要交互终端，请在终端直接运行此脚本。'
    trap cleanup EXIT
    trap 'log "安装未完成（第 $LINENO 行）；已保存的配置和安装文件会保留。"' ERR
    trap 'log "安装已取消。"; exit 130' INT
    trap 'log "安装已终止。"; exit 143' TERM
    umask 077
    ensure_glibc
    ensure_tools
    if [[ -z $INSTALL_DIR ]]; then
        ask '安装目录' "$HOME/AWA-Helper"
        INSTALL_DIR=$REPLY
    fi
    if [[ $INSTALL_DIR == \~/* ]]; then
        INSTALL_DIR="$HOME/${INSTALL_DIR#\~/}"
    fi
    if [[ $INSTALL_DIR != /* ]]; then
        INSTALL_DIR="$PWD/$INSTALL_DIR"
    fi
    [[ ! $INSTALL_DIR =~ [[:cntrl:]] ]] || die '安装目录不能包含控制字符。'
    assert_no_link "$INSTALL_DIR"
    INSTALL_DIR=$(realpath -m -- "$INSTALL_DIR")
    [[ $INSTALL_DIR != / ]] || die '不能安装到文件系统根目录。'
    check_stopped "$INSTALL_DIR"
    WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/awa-install.XXXXXXXX")
    if [[ $CONFIGURE_ONLY == false ]]; then
        install_release "$INSTALL_DIR" "$VERSION"
    fi
    [[ -f $INSTALL_DIR/AWA-Helper ]] || die '安装目录缺少 AWA-Helper。'
    mkdir -p "$INSTALL_DIR/logs"
    configure "$INSTALL_DIR"
    start_installed "$INSTALL_DIR"
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
