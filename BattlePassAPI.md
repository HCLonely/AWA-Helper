
1. 从control-center中获取"Battle Pass"页面链接：

```html
<div class="um-account">
    <section class="um-nav-links">
        <div class="um-nav-link-container d-flex flex-column">
                            <a class="um-nav-link active" href="/control-center">
                    <i class="fa-solid fa-square-poll-vertical me-2"></i> Control Center
                </a>
                            <a class="um-nav-link " href="/account/personalization">
                    <i class="fa-solid fa-image-portrait me-2"></i> Personalization
                </a>
                            <a class="um-nav-link " href="/account/my-rewards/">
                    <i class="fa-solid fa-store me-2"></i> My Rewards
                </a>
                            <a class="um-nav-link " href="/account/arp-log">
                    <i class="fa-solid fa-book me-2"></i> My ARP Progress
                </a>
                            <a class="um-nav-link " href="/account/endofyear">
                    <i class="fa-solid fa-fire me-2"></i> My Yearly Review
                </a>
                            <a class="um-nav-link " href="/account/communications">
                    <i class="fa-regular fa-message me-2"></i> Communications
                </a>
                            <a class="um-nav-link " href="/member/HCLovely/artifacts">
                    <i class="fa-solid fa-sim-card me-2"></i> Artifacts
                </a>
                            <a class="um-nav-link " href="/member/HCLovely/achievements">
                    <i class="fa-solid fa-award me-2"></i> Achievements
                </a>
                            <a class="um-nav-link " href="/account">
                    <i class="fa-solid fa-key me-2"></i> Account Settings
                </a>
                            <a class="um-nav-link " href="/control-center/battle-pass/1">
                    <i class="fa-solid fa-flag me-2"></i> Battle Pass
                </a>
                    </div>
    </section>
</div>
```

> 在`src\client\AWA\parsers\controlCenter.ts`实现

2. 判断BattlePass是否开启：

```html
<div class="bp-header__action">
                    <div class="bp-header__status">
            <span class="bp-header__tokens">
                BATTLE TOKENS <strong class="bp-header__token-count" data-token-count>0</strong>/<strong class="bp-header__token-total">135</strong>
            </span>
            <span class="bp-header__separator">|</span>
            <span class="bp-header__countdown-label">
                BattlePass ends in
                <strong class="bp-header__countdown" data-countdown="2026-08-25T00:00:00+00:00">
                    --:--:--:--
                </strong>
            </span>
        </div>

                    <div class="bp-header__started">
                Your Battle Pass Has Started!
            </div>
            </div>
```

全部完成：
```html
                    <div class="bp-header__status">
            <span class="bp-header__tokens">
                BATTLE TOKENS <strong class="bp-header__token-count" data-token-count>135</strong>/<strong class="bp-header__token-total">135</strong>
            </span>
            <span class="bp-header__separator">|</span>
            <span class="bp-header__countdown-label">
                BattlePass ends in
                <strong class="bp-header__countdown" data-countdown="2026-08-25T00:00:00+00:00">
                    --:--:--:--
                </strong>
            </span>
        </div>

                    <div class="bp-header__completed">
                BATTLE PASS COMPLETED
            </div>
            </div>
```

3. 识别物品信息:

```html
   <div class="bp-map__markers" id="bp-markers">

            <div class="bp-marker bp-marker--unlockable"
                 data-index="0"
                 data-milestone-id="1"
                 data-state="unlockable"
                 title="15 Battle Tokens">
                                    <img class="bp-marker__image" src="https://media.alienwarearena.com/media/69e6ccb79c5f092f9f3776478a5ac0d5.png?fit=crop&amp;width=128&amp;height=128&amp;quality=75" alt="15 Battle Tokens" />

                                                            <span class="bp-marker__badge bp-marker__badge--unlockable" aria-label="Ready to claim">
                            <i class="fa fa-lock-open"></i>
                        </span>

                <div class="bp-marker__popup" id="bp-popup-1" style="display:none;">
                    <div class="bp-popup" data-milestone-id="1">
    <button class="bp-popup__close" type="button" aria-label="Close" data-popup-close>&times;</button>

    <h3 class="bp-popup__title">15 Battle Tokens</h3>

            <div class="bp-popup__image-wrap">
            <img class="bp-popup__image" src="https://media.alienwarearena.com/media/69e6ccb79c5f092f9f3776478a5ac0d5.png?fit=crop&amp;width=200&amp;height=200&amp;quality=75" alt="15 Battle Tokens" />
        </div>

            <p class="bp-popup__desc">Battle Tokens can be redeemed for exclusive rewards in the Battle Store at the end of the Season.</p>


    <div class="bp-popup__arp">25 ARP Required</div>

        <div class="bp-popup__action" data-claim-slot>
                    <form method="post"
                  action="/battle-pass/claim/251538"
                  data-claim-form
                  data-milestone-id="1">
                <button type="submit" class="bp-popup__claim-btn">CLAIM</button>
                <input type="hidden" name="_csrf_token" value="4f51060b7b1e4d7c362dc021257304.3RL4J_saaERWp93q2ZEw76u_HYwJZtGlF2dMA1MdXXY.lFafSshuA2kxlKy5ktUCvvnOLdh5JIHGYA50czV3J0KMVKpdgWBQBw6emA">
            </form>
            <p class="bp-popup__claim-error" data-claim-error hidden></p>
            </div>
</div>

                </div>
            </div>

            <div class="bp-marker bp-marker--in_progress bp-marker--hidden"
                 data-index="1"
                 data-milestone-id="11"
                 data-state="in_progress"
                 title="Audio Archive Stone Artifact">
                                                        <span class="bp-marker__hidden-hit" aria-label="Audio Archive Stone Artifact"></span>


                <div class="bp-marker__popup" id="bp-popup-11" style="display:none;">
                    <div class="bp-popup" data-milestone-id="11">
    <button class="bp-popup__close" type="button" aria-label="Close" data-popup-close>&times;</button>

    <h3 class="bp-popup__title">Audio Archive Stone Artifact</h3>

            <div class="bp-popup__image-wrap">
            <img class="bp-popup__image" src="https://media.alienwarearena.com/media/6fa958e93cb4eb816bb144fe37bb9414.jpg?fit=crop&amp;width=200&amp;height=200&amp;quality=75" alt="Audio Archive Stone Artifact" />
        </div>

            <p class="bp-popup__desc">An exclusive Season 0 Artifact.

This is a Clothing Artifact and effects the color of your Username.</p>

            <div class="bp-popup__progress">
            <div class="bp-popup__progress-bar">
                                <div class="bp-popup__progress-fill" style="width: 44%"></div>
            </div>
            <div class="bp-popup__progress-text">11/25</div>
        </div>

    <div class="bp-popup__arp">25 ARP Required</div>

        <div class="bp-popup__action" data-claim-slot>
            </div>
</div>

                </div>
            </div>

            <div class="bp-marker bp-marker--locked"
                 data-index="2"
                 data-milestone-id="12"
                 data-state="locked"
                 title="ARP Boost">
                                    <img class="bp-marker__image" src="https://media.alienwarearena.com/media/4611507b4f5017260423a5e3dff201e4.gif?fit=crop&amp;width=128&amp;height=128&amp;quality=75" alt="ARP Boost" />

                                                            <span class="bp-marker__badge bp-marker__badge--locked" aria-label="Locked">
                            <i class="fa fa-lock"></i>
                        </span>

                <div class="bp-marker__popup" id="bp-popup-12" style="display:none;">
                    <div class="bp-popup" data-milestone-id="12">
    <button class="bp-popup__close" type="button" aria-label="Close" data-popup-close>&times;</button>

    <h3 class="bp-popup__title">ARP Boost</h3>

            <div class="bp-popup__image-wrap">
            <img class="bp-popup__image" src="https://media.alienwarearena.com/media/4611507b4f5017260423a5e3dff201e4.gif?fit=crop&amp;width=200&amp;height=200&amp;quality=75" alt="ARP Boost" />
        </div>

            <p class="bp-popup__desc">Additional ARP to boost you through the Battle Pass.</p>


    <div class="bp-popup__arp">30 ARP Required</div>

        <div class="bp-popup__action" data-claim-slot>
            </div>
</div>

                </div>
            </div>
```

- 通过`<div class="bp-marker bp-marker--unlockable" data-index="0" data-milestone-id="1" data-state="unlockable" title="15 Battle Tokens">`识别物品信息, 已领取的`data-state`为`claimed`
- 对于可解锁(unlockable)物品，提取请求信息(post path, _csrf_token)：

```html
        <div class="bp-popup__action" data-claim-slot>
                    <form method="post"
                  action="/battle-pass/claim/251538"
                  data-claim-form
                  data-milestone-id="1">
                <button type="submit" class="bp-popup__claim-btn">CLAIM</button>
                <input type="hidden" name="_csrf_token" value="4f51060b7b1e4d7c362dc021257304.3RL4J_saaERWp93q2ZEw76u_HYwJZtGlF2dMA1MdXXY.lFafSshuA2kxlKy5ktUCvvnOLdh5JIHGYA50czV3J0KMVKpdgWBQBw6emA">
```

返回结果格式如下：

```json
{success: true, milestoneId: 1, userMilestoneId: 251538}
```
