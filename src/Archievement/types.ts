/*
 * @Author       : HCLonely
 * @Date         : 2026-01-04 20:19:00
 * @LastEditTime : 2026-01-06 15:35:04
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Achievements-Helper/src/types.ts
 * @Description  : 类型定义
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

// interface Avatar {
//     id: string;
//     name: string;
//     slotType: string;
//     category: string;
//     equipped: boolean;
// }

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
