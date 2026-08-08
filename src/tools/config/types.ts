/**
 * @file config types
 * @description Defines the normalized Manager configuration while retaining legacy fields during migration.
 */
export interface ArtifactScheduleConfig {
  cron: string
  ids: number[]
}

export interface NormalizedManagerConfig {
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
