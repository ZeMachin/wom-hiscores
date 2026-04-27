import { PlayerResponse } from "@wise-old-man/utils";

export interface GroupHiscoresEntryResponse {
    player: PlayerResponse;
    data: GroupHiscoresSkillData | GroupHiscoresBossData | GroupHiscoresActivityData | GroupHiscoresComputedMetricData;
}

export interface GroupHiscoresSkillData {
    type: 'skill';
    rank: number;
    level: number;
    experience: number;
}

export interface GroupHiscoresBossData {
    type: 'boss';
    rank: number;
    kills: number;
}

export interface GroupHiscoresActivityData {
    type: 'activity';
    rank: number;
    score: number;
}

export interface GroupHiscoresComputedMetricData {
    type: 'computed';
    rank: number;
    value: number;
}