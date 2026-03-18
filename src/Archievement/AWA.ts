/*
 * @Author       : HCLonely
 * @Date         : 2026-01-08 10:56:32
 * @LastEditTime : 2026-03-18 11:03:19
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/Archievement/AWA.ts
 * @Description  : AWA API
 */

/* global __, proxy, myAxiosConfig */
import { RawAxiosRequestHeaders, AxiosResponse, AxiosError } from 'axios';
import { load, Cheerio, Element } from 'cheerio';
import * as chalk from 'chalk';
import { Logger, time, netError, http as axios, formatProxy, Cookie } from './tool';
import { Achievement, Border, AvailableStreams } from './types';

class AWA {
  headers: RawAxiosRequestHeaders;
  cookie: Cookie;
  httpsAgent!: myAxiosConfig['httpsAgent'];
  userId!: string;
  username!: string;
  newCookie: string;
  proxy?: {
    server: string
    username?: string
    password?: string
  };
  awaHost!: string;

  constructor({ awaCookie, proxy, awaHost, userAgent }: {
    awaCookie: string
    proxy?: proxy
    awaHost: string
    userAgent?: string
  }) {
    this.newCookie = awaCookie;
    this.cookie = new Cookie(awaCookie);
    this.headers = {
      cookie: this.cookie.stringify(),
      'user-agent': userAgent,
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
    };

    if (proxy?.enable?.includes('awa') && proxy.host && proxy.port) {
      this.httpsAgent = formatProxy(proxy);
      this.proxy = {
        server: `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`,
        username: proxy.username,
        password: proxy.password
      };
    }
    this.awaHost = awaHost;
  }

  async init(): Promise<boolean> {
    await this.updateCookie();
    const result = await this.verifyCookie();
    if (!result) {
      return false;
    }
    this.newCookie = this.cookie.stringify();
    return true;
  }

  async verifyCookie(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('verifyingToken', chalk.yellow('Cookie'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/account`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response: AxiosResponse) => {
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          new Logger(response.data || response.statusText);
          return false;
        }
        const $ = load(response.data);
        if ($('a.nav-link-login').length > 0) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
          return false;
        }

        const [, , awaUserId] = response.data.match(/(var|let)[\s]+?user_id[\s]*?=[\s]*?([\d]+);/);
        const [, , awaUsername] = response.data.match(/(var|let)[\s]+?user_username[\s]*?=[\s]*?"([\w]+)";/);
        this.userId = awaUserId;
        this.username = awaUsername;
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return true;
      })
      .catch((error: AxiosError) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        new Logger(error);
        return false;
      });
  }

  async updateCookie(): Promise<boolean> {
    const logger = new Logger(`${time()}${__('updatingCookie', chalk.yellow('AWA Cookie'))}...`, false);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/`,
      method: 'GET',
      headers: {
        ...this.headers,
        cookie: this.cookie.stringify(),
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      maxRedirects: 0,
      validateStatus: (status: number) => status === 302 || status === 200,
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response: AxiosResponse) => {
        if (response.status === 200 && response.data.toLowerCase().includes('we have detected an issue with your network')) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('ipBanned')));
          return false;
        }
        if (!response.headers['set-cookie']?.length) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        this.headers.cookie = this.cookie.update(response.headers['set-cookie']).stringify();
        if (response.status === 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        if (response.status === 302) {
          const homeSite = this.cookie.get('home_site');
          if (homeSite && this.awaHost !== homeSite) {
            this.awaHost = homeSite;
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.yellow(__('redirected')));
            return this.updateCookie();
          }
          if (this.cookie.get('REMEMBERME') === 'deleted') {
            ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('cookieExpired', chalk.yellow('awaCookie'))}`));
            return false;
          }
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response);
        return false;
      })
      .catch((error: AxiosError) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)') + netError(error));
        new Logger(error);
        return false;
      });
  }

  async getBorders(): Promise<Array<Border> | null> {
    const logger = new Logger(`${time()}${__('getting', chalk.yellow('Borders'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/account/personalization`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response: AxiosResponse) => {
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          new Logger(response.data || response.statusText);
          return null;
        }
        const $ = load(response.data);
        if ($('a.nav-link-login').length > 0) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
          return null;
        }

        const [, , awaUserId] = response.data.match(/(var|let)[\s]+?user_id[\s]*?=[\s]*?([\d]+);/);
        this.userId = awaUserId;

        const borderElements = $('.account-borders__list-wrapper a[data-border-name]');

        const borders: Border[] = [];
        borderElements.each((_, element) => {
          const borderId = $(element).attr('data-border-id');
          const borderName = $(element).attr('data-border-name');

          if (borderId && borderName) {
            borders.push({
              id: borderId,
              name: borderName
            });
          }
        });

        if (!borders.length) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noAvailableBorder')}`));
          return null;
        }

        // this.borderId = awaBorderId;
        // fs.writeFileSync('.awa-info.json', JSON.stringify({
        //   awaUserId: this.userId,
        //   awaBorderId: this.borderId,
        //   awaAvatar: this.avatar
        // }));
        // if (os.type() === 'Windows_NT') {
        //   try {
        //     execSync('attrib +h .awa-info.json');
        //   } catch (e) {
        //     //
        //   }
        // }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return borders;
      })
      .catch((error: AxiosError) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        new Logger(error);
        return null;
      });
  }

  async changeBorder(borderId: number): Promise<boolean> {
    const logger = new Logger(`${time()}${__('changing', chalk.yellow('Border'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/border/select`,
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: `https://${this.awaHost}`,
        referer: `https://${this.awaHost}/account/personalization`
      },
      data: JSON.stringify({ id: borderId }),
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response: AxiosResponse) => {
        if (response.data.success) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error: AxiosError) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        new Logger(error);
        return false;
      });
  }

  async getAvatar(): Promise<Array<string> | null> {
    const logger = new Logger(`${time()}${__('getting', chalk.yellow('Avatar'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/account/personalization`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response: AxiosResponse) => {
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          new Logger(response.data || response.statusText);
          return null;
        }
        const $ = load(response.data);
        if ($('a.nav-link-login').length > 0) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
          return null;
        }

        const avatarsId = [...response.data.matchAll(/"\/avatar\/change\/(\d+)"/g)].map((e) => e[1]).filter((e) => e);

        if (!avatarsId.length) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(`Error: ${__('noAvailableAvatar')}`));
          return null;
        }

        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return avatarsId;
      })
      .catch((error: AxiosError) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        new Logger(error);
        return null;
      });
  }
  async changeAvatar(avatarId: string): Promise<boolean> {
    const logger = new Logger(`${time()}${__('changing', chalk.yellow('Avatar'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/avatar/change/${avatarId}`,
      method: 'GET',
      headers: {
        ...this.headers,
        origin: `https://${this.awaHost}`,
        referer: `https://${this.awaHost}/account/personalization`
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

    return axios(options)
      .then((response: AxiosResponse) => {
        if (!response.data.includes(`"/avatar/change/${avatarId}"`)) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
          return true;
        }
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
        new Logger(response.data?.message || response);
        return false;
      })
      .catch((error: AxiosError) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        new Logger(error);
        return false;
      });
  }

  // async getAvatar(): Promise<{ avatars?: Avatar[], currentAvatar?: AvatarConfig }> {
  //   const logger = new Logger(`${time()}${__('getting', chalk.yellow('Avatar'))}`, false);
  //   const options: myAxiosConfig = {
  //     url: `https://${this.awaHost}/avatar/edit`,
  //     method: 'GET',
  //     headers: {
  //       ...this.headers,
  //       accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
  //       referer: `https://${this.awaHost}/account/personalization`
  //     },
  //     Logger: logger
  //   };
  //   if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
  //   return axios(options)
  //     .then((response: AxiosResponse) => {
  //       if (response.status !== 200) {
  //         ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
  //         return {};
  //       }

  //       const $ = load(response.data);
  //       if ($('a.nav-link-login').length > 0) {
  //         ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
  //         return {};
  //       }

  //       const inventoryContainers = $('.inventory-container[data-slot-type]');

  //       const avatars: Avatar[] = [];
  //       const currentAvatar: AvatarConfig = {
  //         body: null,
  //         hat: null,
  //         top: null,
  //         item: null,
  //         legs: null,
  //         feet: null
  //       };

  //       inventoryContainers.each((_, container) => {
  //         const slotType = $(container).attr('data-slot-type');
  //         const avatarItems = $(container).find('.avatar-item[data-id]');

  //         avatarItems.each((_, item) => {
  //           const avatarId = $(item).attr('data-id');
  //           const avatarName = $(item).attr('title');
  //           const avatarCategory = $(item).attr('data-category');
  //           const avatarSlotType = $(item).attr('data-slot-type');
  //           const isEquipped = $(item).hasClass('equipped');

  //           if (avatarId && avatarName) {
  //             avatars.push({
  //               id: avatarId,
  //               name: avatarName,
  //               slotType: avatarSlotType || slotType || '',
  //               category: avatarCategory || '',
  //               equipped: isEquipped
  //             });

  //             if (isEquipped) {
  //               const slot = avatarSlotType || slotType || '';
  //               const validSlots: (keyof AvatarConfig)[] = ['body', 'hat', 'top', 'item', 'legs', 'feet'];
  //               if (validSlots.includes(slot as keyof AvatarConfig)) {
  //                 currentAvatar[slot as keyof AvatarConfig] = { id: avatarId };
  //               }
  //             }
  //           }
  //         });
  //       });
  //       return { avatars, currentAvatar };
  //     })
  //     .catch((error: AxiosError) => {
  //       ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
  //       new Logger(error);
  //       return {};
  //     });
  // }
  // async changeAvatar(avatarInfo: AvatarConfig): Promise<boolean> {
  //   const logger = new Logger(`${time()}${__('changing', chalk.yellow('Avatar'))}`, false);
  //   const options: myAxiosConfig = {
  //     url: `https://${this.awaHost}/ajax/user/avatar/save/${this.userId}`,
  //     method: 'POST',
  //     headers: {
  //       ...this.headers,
  //       'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  //       origin: `https://${this.awaHost}`,
  //       referer: `https://${this.awaHost}/avatar/edit/hat`
  //     },
  //     data: JSON.stringify(avatarInfo),
  //     Logger: logger
  //   };
  //   if (this.httpsAgent) options.httpsAgent = this.httpsAgent;

  //   return axios(options)
  //     .then((response: AxiosResponse) => {
  //       if (response.data.success === 'true') {
  //         ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
  //         return true;
  //       }
  //       ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(1)'));
  //       new Logger(response.data?.message || response);
  //       return false;
  //     })
  //     .catch((error: AxiosError) => {
  //       ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
  //       new Logger(error);
  //       return false;
  //     });
  // }

  async getAvailableStreams(): Promise<AvailableStreams> {
    const logger = new Logger(`${time()}${__('getting', chalk.yellow('AvailableStreams'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/control-center`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response: AxiosResponse) => {
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          new Logger(response.data || response.statusText);
          return { Hive: [], Nexus: [] };
        }
        const $ = load(response.data);
        if ($('a.nav-link-login').length > 0) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
          return { Hive: [], Nexus: [] };
        }

        // 1. 找到含有Watch Twitch的user-profile__profile-card元素
        const profileCards = $('.user-profile__profile-card');
        let twitchCard: Cheerio<Element> | null = null;

        profileCards.each((_, card) => {
          const header = $(card).find('.user-profile__card-header');
          if (header.length > 0 && header.text().includes('Watch Twitch')) {
            twitchCard = $(card);
            return false; // break out of each loop
          }
        });

        if (!twitchCard) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Watch Twitch card not found'));
          return { Hive: [], Nexus: [] };
        }

        // 2. 从找到的元素中找到.user-profile__card-body元素
        const cardBody = (twitchCard as Cheerio<Element>).find('.user-profile__card-body');
        if (cardBody.length === 0) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Card body not found'));
          return { Hive: [], Nexus: [] };
        }

        // 3. 获取其中所有的.row元素
        const rows = cardBody.find('.row');

        const result: AvailableStreams = {
          Hive: [],
          Nexus: []
        };

        let currentCategory: 'Hive' | 'Nexus' | null = null;

        // 4-7. 处理每个row元素
        rows.each((_: any, row: Element) => {
          const tableHeading = $(row).find('.card-table-heading');

          if (tableHeading.length > 0) {
            // 5. 找到含有"Hive"或"Nexus"文本的目标row
            const headingText = tableHeading.text().trim();
            if (headingText.includes('Hive')) {
              currentCategory = 'Hive';
            } else if (headingText.includes('Nexus')) {
              currentCategory = 'Nexus';
            } else {
              currentCategory = null;
            }
          } else if (currentCategory && $(row).find('.quest-list__stream-thumbnail').length > 0) {
            // 6-7. 这是stream row，根据当前分类处理
            const streamLinks = $(row).find('.quest-list__stream-thumbnail a[href]');

            streamLinks.each((_, link) => {
              const href = $(link).attr('href');
              if (href) {
                // 8-9. 从直播地址中提取主播名
                const match = href.match(/www\.twitch\.tv\/([^/?]+)/);
                if (match && match[1]) {
                  const [, streamerName] = match;
                  if (!result[currentCategory as keyof AvailableStreams].includes(streamerName)) {
                    result[currentCategory as keyof AvailableStreams].push(streamerName);
                  }
                }
              }
            });
          }
        });
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return result;
      })
      .catch((error: AxiosError) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        new Logger(error);
        return { Hive: [], Nexus: [] };
      });
  }

  async getAchievements(): Promise<Achievement[]> {
    const logger = new Logger(`${time()}${__('getting', chalk.yellow('Achievements'))}`, false);
    const options: myAxiosConfig = {
      url: `https://${this.awaHost}/member/${this.username}/achievements`,
      method: 'GET',
      headers: {
        ...this.headers,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      Logger: logger
    };
    if (this.httpsAgent) options.httpsAgent = this.httpsAgent;
    return axios(options)
      .then((response: AxiosResponse) => {
        if (response.status !== 200) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Net Error'));
          new Logger(response.data || response.statusText);
          return [];
        }
        const $ = load(response.data);
        if ($('a.nav-link-login').length > 0) {
          ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.red(__('tokenExpired')));
          return [];
        }

        const categoryContainers = $('.achievement-cards-collection-tab');

        const achievements: Achievement[] = [];

        categoryContainers.each((_, categoryContainer) => {
          const categoryHeaders = $(categoryContainer).find('.stack-title');
          categoryHeaders.each((_, categoryHeader) => {
            const categoryName = $(categoryHeader).text().trim() || 'Unknown';
            const achievementCards = $(categoryHeader).next().find('.achievement-card');

            achievementCards.each((index, card) => {
              const isUnachieved = $(card).hasClass('unachieved');
              const descriptionElement = $(card).find('.achievement-description-text');
              if (descriptionElement.text().trim() === 'Not Earned Yet') {
                return;
              }

              const achievement: Achievement = {
                id: `${categoryName}-${index}`,
                name: `${categoryName} ${index + 1}`,
                completed: !isUnachieved,
                description: descriptionElement.text().trim() || ''
              };

              achievements.push(achievement);
            });
          });
        });
        ((response.config as myAxiosConfig)?.Logger || logger).log(chalk.green('OK'));
        return achievements;
      })
      .catch((error: AxiosError) => {
        ((error.config as myAxiosConfig)?.Logger || logger).log(chalk.red('Error(0)'));
        new Logger(error);
        return [];
      });
  }

  destroy(): void {
    // Clear all properties to release memory
    this.userId = undefined as any;
    this.username = undefined as any;
    this.newCookie = '';
    this.awaHost = '';

    // Clear cookie instance
    if (this.cookie) {
      this.cookie = null as any;
    }

    // Clear headers object
    if (this.headers) {
      this.headers = {} as RawAxiosRequestHeaders;
    }

    // Clear proxy configuration
    if (this.proxy) {
      this.proxy = undefined;
    }

    // Clear https agent
    if (this.httpsAgent) {
      this.httpsAgent = undefined;
    }
  }
}

export { AWA };
