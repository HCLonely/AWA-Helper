# AWA-Helper

外星人论坛自动做任务。

## 使用说明

### 用前说明

1. 使用前请确保AWA帐号已关联Steam帐号且Steam帐号信息已设置为公开；
2. 使用前请确保AWA帐号已关联Twitch帐号且Twitch帐号已给AWA扩展授权;
3. \[不建议\]如需多开，请将本程序复制到不同文件夹运行。

### 通过源码运行

1. 前提条件: 安装[Git](https://git-scm.com/downloads)和[NodeJs](https://nodejs.org/zh-cn/download/);
2. 克隆此项目`git clone https://github.com/HCLonely/AWA-Helper.git`;
3. 安装依赖`npm install -S`;
4. 编辑配置文件,[查看说明](#config文件配置);
5. 运行`npm start`.

### 直接下载编译好的程序运行

1. [点此](https://github.com/HCLonely/AWA-Helper/releases/latest)下载编译好的压缩包；
2. 解压；
3. 编辑配置文件,[查看说明](#config文件配置)；
4. 双击`运行.bat`运行。

## config文件配置

> **需要将`config.example.yml`文件重命名为`config.yml`!!!**

### AWA 配置(必需)

#### AWA 参数说明

```yml
language: 'zh' # 程序显示语言，目前仅支持中文(zh)
awaCookie: '' # 外星人论坛Cookie, 可以只有`REMEMBERME`, 没有`REMEMBERME`则必须有`PHPSESSID`和`sc`, 但会导致连续签到天数获取错误，不会影响其他功能
awaHost: 'www.alienwarearena.com' # 外星人论坛Host, 常用的有`www.alienwarearena.com`和`na.alienwarearena.com`, 默认的没问题就不要改
awaBoosterNotice: true # 外星人论坛任务大于1个时询问是否开启助推器，助推器需要自行开启！！！
awaQuests:
  - dailyQuest # 自动做每日任务，不需要做此任务删除或注释掉此行
  - timeOnSite # 自动做AWA在线任务，不需要做此任务删除或注释掉此行
  - watchTwitch # 自动做Twitch直播间在线任务，不需要做此任务删除或注释掉此行
  - steamQuest # 自动做Steam游戏时长任务，不需要做此任务删除或注释掉此行
awaDailyQuestType: # 每日任务类型，不需要注释掉即可，全部注释=全部开启，如果不需要做每日任务请注释上面的`dailyQuest`
  - click # 浏览页面任务，务标题为任务链接，需点击任务才能完成
  - visitLink # 浏览页面任务，任务标题为任务链接，浏览页面才能完成
  - openLink # 浏览页面任务，任务标题无链接，尝试浏览 排行榜，奖励，商店页面
  - changeBorder # 更换Border
  - changeBadge # 更换Badge
  - changeAvatar # 更换Avatar
  - viewPost # 浏览帖子
  - viewNews # 浏览新闻
  - sharePost # 分享帖子
  - replyPost # 回复帖子
```

#### AWA 参数获取方式

1. 打开[https://www.alienwarearena.com/account/personalization](https://www.alienwarearena.com/account/personalization)页面，打开控制台，找到网络一栏，筛选`personalization`, 复制请求头中`cookie:`后面的部分，粘贴到配置文件中的`awaCookie`部分；
    ![awaCookie](https://github.com/HCLonely/AWA-Helper/raw/main/static/SaMhNF92RY.png)
2. [可选&建议] 打开控制台输入以下内容，并把`你的COOKIE`替换为复制的`cookie`，回车运行后会剔除不需要的`cookie`.

    ```javascript
    console.log(`你的COOKIE`.split(';').map((e) => ['REMEMBERME','PHPSESSID','sc'].includes(e.trim().split('=')[0]) ? e.trim() : null).filter((e) => e).join(';'));
    ```

### Twitch 配置(可选)

> 做Twitch在线任务需要，不想做这个任务可以不填。自动做Twitch任务前需要先在Twitch给外星人扩展授权，只需授权一次即可。

#### Twitch 参数说明

```yml
twitchCookie: '' # Twitch Cookie, 须包括`unique_id` 和 `auth-token`
```

#### Twitch 参数获取方式

1. 打开[https://www.twitch.tv/](https://www.twitch.tv/)页面，打开控制台输入以下内容获取：

```javascript
document.cookie.split(';').filter((e) => ['unique_id','auth-token'].includes(e.split('=')[0].trim())).join(';');
```

### Steam 任务配置

> 挂Steam游戏时长的方式, 支持[ASF](https://github.com/JustArchiNET/ArchiSteamFarm)和[SU](https://github.com/DoctorMcKay/node-steam-user).
>
> **目前`SU`仅支持通过源码运行！！！**

```yml
steamUse: 'ASF' # 'ASF'或'SU','SU'为模拟Steam客户端
```

### ASF 配置(可选)

> 使用[ASF](https://github.com/JustArchiNET/ArchiSteamFarm)挂Steam游戏时长任务需要，不想做这个任务可以不填。需要`steamUse`为`ASF`.

#### ASF 参数说明

```yml
asfProtocol: 'http' # ASF使用的协议，一般都是`http`
asfHost: '127.0.0.1' # ASF使用的Host，本地运行一般是`127.0.0.1`
asfPort: '1242' # ASF使用的端口，默认是`1242`
asfPassword: '' # ASF密码
asfBotname: '' # 要挂游戏的ASF Bot名称
```

### SU 配置(可选)

> 使用[SU](https://github.com/DoctorMcKay/node-steam-user)挂Steam游戏时长任务需要，不想做这个任务可以不填。需要`steamUse`为`SU`.
>
> 如果Steam启用了两步验证，首次使用此方式时注意按控制台提示输入两步验证码。

#### SU 参数说明

```yml
steamAccountName: ''
steamPassword: ''
```

### proxy 配置(可选)

> 代理设置，一般Twitch任务需要。

#### proxy 参数说明

```yml
proxy:
  enable:
    - github # 在检测更新时使用代理，不使用删掉此行
    - twitch # 在访问Twitch站点时使用代理，不使用删掉此行
    - awa # 在访问外星人论坛站点时使用代理，不使用删掉此行
    - asf # 在访问ASF时使用代理，不使用删掉此行
    - steam # 在访问Steam时使用代理，不使用删掉此行
  protocol: 'http' # 代理协议，'http'或'socks'
  host: '127.0.0.1' # 代理host
  port: 1080 # 代理端口
  username: '' # 代理用户名，没有可留空
  password: '' # 代理密码，没有可留空
```

## 关于每日任务

- 每日任务如果有多个，只会默认做第一个任务！

## 运行示例

![Example](https://github.com/HCLonely/AWA-Helper/raw/main/static/NORmcaCfEA.png)

## TODO

## 鸣谢

- [axios](https://github.com/axios/axios)
- [chalk](https://github.com/chalk/chalk)
- [cheerio](https://github.com/cheeriojs/cheerio)
- [dayjs](https://github.com/iamkun/dayjs)
- [node-tunnel](https://github.com/koichik/node-tunnel)
- [node-socks-proxy-agent](https://github.com/TooTallNate/node-socks-proxy-agent)
- [yaml](https://github.com/eemeli/yaml)
- [pkg](https://github.com/vercel/pkg)
- [node-steam-user](https://github.com/DoctorMcKay/node-steam-user)
- [TypeScript](https://github.com/Microsoft/TypeScript)
- [node-fs-extra](https://github.com/jprichardson/node-fs-extra)
- [eslint](https://github.com/eslint/eslint)
- [yaml-lint](https://github.com/rasshofer/yaml-lint)
