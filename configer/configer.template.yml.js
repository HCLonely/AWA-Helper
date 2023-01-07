- name: AWA-Helper
  type: yml
  filename: config.yml
  quote: AWA-Helper配置文件生成器
  author: HCLonely
  body:
    language:
      name: 显示语言
      type: text
      defaultValue: zh
      required: true
    webUI:
      name: WebUI配置
      type: object
      body:
        enable:
          name: 是否启用WebUI
          type: boolean
          defaultValue: false
        port:
          name: WebUI端口
          type: text
          inputType: number
          defaultValue: 3456
    timeout:
      name: 超时设置
      desp: 如果程序运行超过此时间后还在运行，则终止此程序。单位：秒，0为不限制。
      type: text
      inputType: number
      defaultValue: 0
    awaCookie:
      name: 外星人论坛Cookie
      desp: 可以只有`REMEMBERME`, 没有`REMEMBERME`则必须有`PHPSESSID`和`sc`, 但会导致连续签到天数获取错误，不会影响其他功能。
      type: text
      required: true
    autoLogin:
      name: 自动登录配置
      desp: 自动登录AWA更新Cookies。
      type: object
      body:
        enable:
          name: 是否启用
          type: boolean
          defaultValue: false
        username:
          name: AWA用户名[邮箱]
          type: text
        password:
          name: AWA密码
          type: text
    awaHost:
      name: 外星人论坛Host
      desp: 默认的没问题就不要改
      type: text
      defaultValue: www.alienwarearena.com
      required: true
    awaBoosterNotice:
      name: 助推器提醒
      desp: 外星人论坛任务大于1个时询问是否开启助推器，助推器需要自行开启！！！
      type: boolean
      defaultValue: true
    awaQuests:
      name: 需要做的任务类型
      desp: 按`Ctrl`多选
      type: multi-select
      optionsName:
        - 每日任务
        - AWA在线任务
        - Twitch直播间在线任务
        - Steam游戏时长任务
      options:
        - dailyQuest
        - timeOnSite
        - watchTwitch
        - steamQuest
      defaultValue:
        - dailyQuest
        - timeOnSite
        - watchTwitch
        - steamQuest
    awaDailyQuestType:
      name: 需要做的每日任务类型
      desp: 按`Ctrl`多选
      type: multi-select
      optionsName:
        - 浏览页面任务，务标题为任务链接，需点击任务才能完成
        - 浏览页面任务，任务标题为任务链接，浏览页面才能完成
        - 浏览页面任务，任务标题无链接，尝试浏览 排行榜，奖励，商店页面
        - 更换Border
        - 更换Badge
        - 更换Avatar
        - 浏览新闻
        - 分享帖子
        - 回复帖子
      options:
        - click
        - visitLink
        - openLink
        - changeBorder
        - changeBadge
        - changeAvatar
        - viewNews
        - sharePost
        - replyPost
      defaultValue:
        - click
        - visitLink
        - openLink
        - changeBorder
        - changeBadge
        - changeAvatar
        - viewNews
        - sharePost
    awaDailyQuestNumber1:
      name: 每日任务有多个时是否只做第一个
      type: boolean
      defaultValue: true
    boosterRule:
      name: ARP Booster使用规则
      desp: 可使用多个规则，做上面的优先级最高
      type: array
      body:
        - name: 规则
          desp: '例：2x24h>0，此规则代表当2x 24hr ARP Booster数量大于0时使用2x 24hr ARP Booster'
          type: text
          repeat: true
    boosterCorn:
      name: 使用ARP Booster的时间
      desp: 此时间为本地时间，当前日期和boosterCorn匹配的日期为同一天且当前时间大于boosterCorn匹配的时间时启用。格式建议查看config.example.yml文件中的说明。
      type: text
    autoUpdateDailyQuestDb:
      name: 自动更新每日任务数据库
      type: boolean
      defaultValue: false
    twitchCookie:
      name: Twitch Cookie
      desp: 必须包括`unique_id` 和 `auth-token`
      type: text
    steamUse:
      name: 挂Steam游戏时长的方式
      type: single-select
      options:
        - ASF
        - SU
      optionsName:
        - ASF
        - node-steam-user
      defaultValue: ASF
      bindValue:
        type: object
        body:
          ASF:
            asfProtocol:
              name: ASF 协议
              desp: ASF使用的协议，一般都是`http`
              type: single-select
              options:
                - http
                - https
              defaultValue: http
            asfHost:
              name: ASF 地址
              desp: ASF使用的Host，本地运行一般是`127.0.0.1`
              type: text
              defaultValue: '127.0.0.1'
            asfPort:
              name: ASF 端口
              desp: ASF使用的端口，默认是`1242`
              type: text
              inputType: number
              defaultValue: 1242
            asfPassword:
              name: ASF 密码
              type: text
            asfBotname:
              name: ASF Botname
              desp: 要挂游戏的ASF Bot名称
              type: text
          SU:
            steamAccountName:
              name: Steam 用户名
              desp: 使用`node-steam-user`挂Steam游戏时长任务需要，不想做这个任务可以不填。如果Steam启用了两步验证，首次使用此方式时注意按控制台提示输入两步验证码。
              type: text
            steamPassword:
              name: Steam 密码
              desp: 使用`node-steam-user`挂Steam游戏时长任务需要，不想做这个任务可以不填。如果Steam启用了两步验证，首次使用此方式时注意按控制台提示输入两步验证码。
              type: text
    proxy:
      name: 代理设置
      type: object
      body:
        enable:
          name: 在访问哪些站点时启用代理
          desp: 按`Ctrl`多选
          type: multi-select
          options:
            - github
            - twitch
            - awa
            - asf
            - steam
            - pusher
          optionsName:
            - 在检测更新时使用代理
            - 在访问Twitch站点时使用代理
            - 在访问外星人论坛站点时使用代理
            - 在访问ASF时使用代理
            - 在访问Steam时使用代理
            - 在推送时使用代理
          defaultValue:
            - github
            - twitch
            - awa
            - steam
        protocol:
          name: 代理协议
          type: single-select
          options:
            - http
            - https
            - socks4
            - socks5
        host:
          name: 代理host地址
          type: text
          defaultValue: '127.0.0.1'
        port:
          name: 代理端口
          type: text
          inputType: number
          defaultValue: 1080
        username:
          name: 代理用户名，没有可留空
          type: text
        password:
          name: 代理密码，没有可留空
          type: text
    pusher:
      name: 推送设置
      type: object
      body:
        enable:
          name: 是否启用推送
          type: boolean
          defaultValue: false
        platform:
          name: 推送平台
          type: single-select
          defaultValue: GoCqhttp
          options:
            - Bark
            - Chanify
            - DingTalk
            - Discord
            - FeiShu
            - Gitter
            - GoCqhttp
            - GoogleChat
            - IGot
            - Mail
            - Push
            - Pushback
            - PushDeer
            - Pushover
            - PushPlus
            - QqChannel
            - RocketChat
            - ServerChanTurbo
            - Showdoc
            - Slack
            - TelegramBot
            - WorkWeixin
            - WorkWeixinBot
            - WxPusher
            - Xizhi
            - Zulip
          optionsName:
            - Bark
            - Chanify
            - 钉钉群机器人
            - Discord
            - 飞书群机器人
            - Gitter
            - GoCqhttp
            - GoogleChat
            - IGot
            - 邮件
            - Push
            - Pushback
            - PushDeer
            - Pushover
            - PushPlus
            - QQ 频道机器人
            - RocketChat
            - Server 酱
            - Showdoc
            - Slack
            - TelegramBot
            - 企业微信
            - 企业微信群机器人
            - WxPusher
            - 息知
            - Zulip
          bindValue:
            type: object
            isChildren: true
            body:
              Bark:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: Key
                      type: text
                    baseURL:
                      name: baseURL
                      desp: 如果使用自建服务端, 需配置此选项. baseURL为"/yourkey"前面的部分.
                      type: text
              Chanify:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: Token
                      type: text
                    baseURL:
                      name: baseURL
                      desp: 如果使用自建服务端, 需配置此选项. baseURL为"/<token>"前面的部分.
                      type: text
              DingTalk:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: access_token
                      type: text
                    secret:
                      name: secret
                      desp: 如果开启了加签, 此处填写加签密钥.
                      type: text
              Discord:
                key:
                  name: 认证信息
                  type: object
                  body:
                    webhook:
                      name: webhook地址
                      type: text
              FeiShu:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: hook token
                      desp: webhook地址"https://open.feishu.cn/open-apis/bot/v2/hook/"后面的部分.
                      type: text
                    secret:
                      name: secret
                      desp: 如果开启了加签, 此处填写加签密钥.
                      type: text
              Gitter:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: Token
                      type: text
                    roomId:
                      name: roomId
                      type: text
              GoCqhttp:
                key:
                  name: 认证信息
                  type: object
                  body:
                    baseUrl:
                      name: baseUrl
                      desp: go-cqhttp 的http api地址, 以"http://"或"https://"开头.
                      type: text
                    token:
                      name: token
                      type: text
                    user_id:
                      name: user_id
                      desp: 推送的目标 QQ 号, 此参数与"group_id", "channel_id"二选一.
                      type: text
                    group_id:
                      name: group_id
                      desp: 推送的目标群号, 此参数与"user_id", "channel_id"二选一.
                      type: text
                    channel_id:
                      name: channel_id
                      desp: 推送的目标频道ID, 此参数与"user_id", "group_id"二选一, 且必须与"guild_id"同时存在.
                      type: text
                    guild_id:
                      name: guild_id
                      desp: 推送的目标子频道ID, 此参数必须与"channel_id"同时存在.
                      type: text
              GoogleChat:
                key:
                  name: 认证信息
                  type: object
                  body:
                    webhook:
                      name: webhook地址
                      type: text
              IGot:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: 推送key
                      type: text
              Mail:
                key:
                  name: 邮件服务器配置信息
                  type: object
                  body:
                    host:
                      name: 邮件发送服务器地址
                      type: text
                    port:
                      name: 邮件发送服务器端口
                      type: text
                      inputType: number
                    secure:
                      name: 是否启用TLS/SSL
                      type: boolean
                      defaultValue: false
                    auth:
                      name: 认证信息
                      type: object
                      body:
                        user:
                          name: 邮件发送服务器的用户名
                          type: text
                          required: true
                        pass:
                          name: 邮件发送服务器的密码
                          type: text
                          required: true
                options:
                  name: 收发邮箱配置
                  type: object
                  body:
                    from:
                      name: 发送邮件的邮箱地址
                      type: text
                      inputType: email
                    to:
                      name: 接受邮件的邮箱地址
                      type: text
                      inputType: email
              Push:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: API key
                      type: text
              Pushback:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: at_token
                      type: text
                    userId:
                      name: User_id
                      type: text
              PushDeer:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: pushkey
                      type: text
                    baseURL:
                      name: baseURL
                      desp: 如果使用自建服务端, 需配置此选项.
                      type: text
              Pushover:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: API Token
                      type: text
                    user:
                      name: user
                      type: text
              PushPlus:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: token
                      type: text
              QqChannel:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: token
                      desp: QQ频道机器人的 token
                      type: text
                    appID:
                      name: appID
                      desp: QQ频道机器人的 ID
                      type: text
                    channelID:
                      name: channelID
                      desp: QQ频道的子频道 ID
                      type: text
                    sandbox:
                      name: sandbox
                      desp: 使用QQ频道推送时是否启用沙箱
                      type: boolean
                      defaultValue: false
              RocketChat:
                key:
                  name: 认证信息
                  type: object
                  body:
                    webhook:
                      name: webhook 地址
                      type: text
              ServerChanTurbo:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: token
                      type: text
              Showdoc:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: token
                      desp: 推送地址"https://push.showdoc.com.cn/server/api/push/"后面的部分.
                      type: text
              Slack:
                key:
                  name: 认证信息
                  type: object
                  body:
                    webhook:
                      name: webhook 地址
                      type: text
              TelegramBot:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: token
                      type: text
                    chat_id:
                      name: chat_id
                      type: text
              WorkWeixin:
                key:
                  name: 认证信息
                  type: object
                  body:
                    secret:
                      name: secret
                      desp: 管理员进入企业微信管理后台后点击“客户联系”-“客户”页面. 点开“API”小按钮, 可以看到secret.
                      type: text
                    corpid:
                      name: corpid
                      desp: 企业管理员可在管理端“我的企业”－“企业信息”下直接查看的“企业ID”.
                      type: text
                    agentid:
                      name: agentid
                      desp: 企业应用的id. 企业内部开发，可在应用的设置页面查看.
                      type: text
                      inputType: number
                    touser:
                      name: touser
                      desp: 指定接收消息的成员, 成员ID列表(多个接收者用"|"分隔, 最多支持1000个). 特殊情况:指定为"@all", 则向该企业应用的全部成员发送. 企业管理员可在管理端“通讯录”->点进某个成员的详情页中直接查看“帐号”。
                      type: text
              WorkWeixinBot:
                key:
                  name: 认证信息
                  type: object
                  body:
                    webhook:
                      name: webhook 地址
                      type: text
              WxPusher:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: appToken
                      type: text
                    uids:
                      name: uids
                      type: array
                      desp: 发送目标的 UID, 也可在"sendOptions"中配置
                      body:
                        - name: uid
                          desp: 点击+号新增
                          type: text
                          repeat: true
                    topicIds:
                      name: topicIds
                      type: array
                      desp: 发送目标的 topicId, 也可在"sendOptions"中配置
                      body:
                        - name: topicId
                          desp: 点击+号新增
                          type: text
                          inputType: number
                          repeat: true
              Xizhi:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: key
                      type: text
              Zulip:
                key:
                  name: 认证信息
                  type: object
                  body:
                    token:
                      name: api key
                      type: text
                    domain:
                      name: yourZulipDomain
                      type: text
                    email:
                      name: bot email
                      type: text
                    to:
                      name: 发送对象Id
                      type: array
                      body:
                        - name: id
                          type: text
                          repeat: true
