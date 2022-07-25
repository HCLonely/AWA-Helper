# AWA-Helper

外星人论坛自动做任务。

## 使用说明

### 用前说明

1. 使用前请确保AWA帐号已关联Steam帐号且Steam帐号信息已设置为公开；
2. 使用前请确保AWA帐号已关联Twitch帐号且Twitch帐号已给AWA扩展授权;
3. 如需多开，请将本程序复制到不同文件夹运行。

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
awaCookie: '' # 外星人论坛Cookie, 可以只有`REMEMBERME`, 没有`REMEMBERME`则必须有`PHPSESSID`和`sc`, 但会导致连续签到天数获取错误，不会影响其他功能
awaHost: 'www.alienwarearena.com' # 外星人论坛Host, 常用的有`www.alienwarearena.com`和`na.alienwarearena.com`, 默认的没问题就不要改
awaUserId: '' # 外星人论坛用户Id
awaBorderId: '' # 外星人论坛当前使用的BorderId
awaBadgeIds: '' # 外星人论坛当前使用的BadgeIds
awaAvatar: '' # 外星人论坛当前使用的Avatar
awaBoosterNotice: true # 外星人论坛任务大于1个时询问是否开启助推器，助推器需要自行开启！！！
awaQuests:
  - dailyQuest # 自动做每日任务，不需要做此任务删除或注释掉此行
  - timeOnSite # 自动做AWA在线任务，不需要做此任务删除或注释掉此行
  - watchTwitch # 自动做Twitch直播间在线任务，不需要做此任务删除或注释掉此行
  - steamQuest # 自动做Steam游戏时长任务，不需要做此任务删除或注释掉此行
```

#### AWA 参数获取方式

1. 打开[https://www.alienwarearena.com/account/personalization](https://www.alienwarearena.com/account/personalization)页面，打开控制台，找到网络一栏，筛选`personalization`, 复制请求头中`cookie:`后面的部分，粘贴到配置文件中的`awaCookie`部分；
    ![awaCookie](https://github.com/HCLonely/AWA-Helper/raw/main/static/SaMhNF92RY.png)
2. [可选&建议] 打开控制台输入以下内容，并把`你的COOKIE`替换为复制的`cookie`，回车运行后会剔除不需要的`cookie`.

    ```javascript
    console.log(`你的COOKIE`.split(';').map((e) => ['REMEMBERME','PHPSESSID','sc'].includes(e.trim().split('=')[0]) ? e.trim() : null).filter((e) => e).join(';'));
    ```

3. 除`awaCookie`外，其他参数可在[https://www.alienwarearena.com/account/personalization](https://www.alienwarearena.com/account/personalization)页面，打开控制台输入以下内容获取：

    ```javascript
    console.log(`awaUserId: '${user_id}'\nawaBorderId: '${selectedBorder}'\nawaBadgeIds: '${selectedBadges.join(',')}'`);
    ```

4. `awaAvatar`获取方式：打开[https://www.alienwarearena.com/avatar/edit](https://www.alienwarearena.com/avatar/edit)页面，并打开控制台输入以下内容获取：

    ```javascript
    console.log(`awaAvatar: '${JSON.stringify({body: null, hat: null, top: null, item: null, legs: null, top: null, ...Object.fromEntries($.makeArray($('.drag-drop')).map((e) => {
        const slotType = $(e).attr('data-slot-type').split('-')[0];
        const altimg = $(e).attr('data-altImg');
        const data = {
            id: $(e).attr('data-id'),
            img: $(e).attr('data-img'),
            slotType: $(e).attr('data-slot-type')
        };
        if (altimg) {
            data.altimg = altimg;
        }
        return [slotType, data]
    }))})}'`);
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

### ASF 配置(可选)

> 做Steam挂游戏时长任务需要，不想做这个任务可以不填。

#### ASF 参数说明

```yml
asfProtocol: 'http' # ASF使用的协议，一般都是`http`
asfHost: '127.0.0.1' # ASF使用的Host，本地运行一般是`127.0.0.1`
asfPort: '1242' # ASF使用的端口，默认是`1242`
asfPassword: '' # ASF密码
asfBotname: '' # 要挂游戏的ASF Bot名称
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
  protocol: 'http' # 代理协议，'http'或'socks'
  host: '127.0.0.1' # 代理host
  port: 1080 # 代理端口
  username: '' # 代理用户名，没有可留空
  password: '' # 代理密码，没有可留空
```

## 关于每日任务

1. 每日任务会尝试做换Border、换Badge、浏览帖子、分享帖子、回复帖子，如果无法完成也不会继续尝试其他方法！
2. 每日任务如果有多个，只会默认做第一个任务！

## 运行示例

![Example](https://github.com/HCLonely/AWA-Helper/raw/main/static/NORmcaCfEA.png)

## TODO
