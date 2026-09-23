/**
 * @file src/types/achievement.ts
 * @description 定义成就记录、头像配置、可装备物品及成就操作历史的数据结构。
 */
interface Achievement {
    id: string;
    name: string;
    completed: boolean;
    description?: string;
}

interface Id {
    id: string;
    name: string;
}

interface userAvatarInfo {
    avatar: string
    border: string
    background: string
}

interface avatarIds {
    userAvatarInfo: userAvatarInfo,
    ids: Array<Id>
}

interface ActionHistory {
    border: {
        date: string;
        used: string[];
    };
    avatar: {
        date: string;
        used: string[];
    };
}

interface AvailableStreams {
    Hive: string[];
    Nexus: string[];
}

export type { Achievement, Id, userAvatarInfo, avatarIds, ActionHistory, AvailableStreams };
