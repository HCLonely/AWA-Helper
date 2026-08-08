/**
 * @file Achievement types
 * @description Shared data models for achievement automation and action history.
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
