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

interface Border {
    id: string;
    name: string;
}

interface Avatar {
    id: string;
    name: string;
    slotType: string;
    category: string;
    equipped: boolean;
}

interface AvatarConfig {
    body: { id: string } | null;
    hat: { id: string } | null;
    top: { id: string } | null;
    item: { id: string } | null;
    legs: { id: string } | null;
    feet: { id: string } | null;
}

interface ActionHistory {
    border: {
        date: string;
        used: string[];
    };
    avatar: {
        date: string;
        used: { [slotType: string]: string[] };
    };
}

interface AvailableStreams {
    Hive: string[];
    Nexus: string[];
}

export type { Achievement, Border, Avatar, AvatarConfig, ActionHistory, AvailableStreams };
