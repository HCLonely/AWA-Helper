/**
 * @file src/tools/config/types.ts
 * @description 定义当前配置、旧版兼容配置以及加载完成后的标准配置类型。
 */
export interface ArtifactScheduleConfig {
  cron: string
  ids: number[]
}

export interface NormalizedManagerConfig {
  timezone?: string
  historyLimit?: number
  secret: string
  dailyQuestCron?: string
  achievement: {
    enable: boolean
    cron: string
  }
  artifacts: ArtifactScheduleConfig[]
}

export interface LoadedConfig {
  path: string
  raw: config
  manager: NormalizedManagerConfig
}
