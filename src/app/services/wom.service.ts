import { Injectable } from '@angular/core';
import { Activity, Boss, ComputedMetric, GroupHiscoresEntryResponse, Metric, Skill, WOMClient, GroupResponse, PlayerType, BossMetaConfig, EfficiencyAlgorithmType, SkillMetaConfig, PlayerDetailsResponse, PlayerBuild } from '@wise-old-man/utils';
import { GroupHiscoresSkillData, GroupHiscoresBossData, GroupHiscoresActivityData, GroupHiscoresComputedMetricData } from '../model/group-hiscore-data.model';
import { environment } from 'src/environments/environment';

const API_KEY = environment.API_KEY;
const userAgent = environment.agentName;

export type Score = {
  metric: Metric;
  ranking: number | 'N/A';
  value: number | 'N/A';
  next: {
    value: number | 'N/A';
    difference: number | 'N/A';
    player: string | 'N/A';
    timeToNext: number | 'N/A';
  };
  first: {
    value: number | 'N/A';
    difference: number | 'N/A';
    player: string | 'N/A';
    timeToFirst: number | 'N/A';
  };
};

const client = new WOMClient({
  apiKey: API_KEY,
  userAgent
});

const hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function getStorageCache<T>(cacheKey: string): { data: T; timestamp: number } | null {
  if (!hasLocalStorage) {
    return null;
  }

  const cached = localStorage.getItem(cacheKey);
  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached) as { data: T; timestamp: number };
  } catch {
    return null;
  }
}

function setStorageCache(cacheKey: string, data: unknown): void {
  if (!hasLocalStorage) {
    return;
  }

  localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
}

@Injectable({
  providedIn: 'root',
})
export class WomService {
  private isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

  async getPlayerDetails(playerName: string): Promise<PlayerDetailsResponse> {
    if (!this.isBrowser) throw new Error('Player details can only be fetched in a browser environment with localStorage support.');
    return await client.players.getPlayerDetails(playerName);
  }

  async getEhbRates(eat: EfficiencyAlgorithmType): Promise<BossMetaConfig[]> {
    if (!this.isBrowser) throw new Error('API calls can only be made in a browser environment with localStorage support.');
    const cacheKey = `ehb_${eat}`;
    const cached = getStorageCache<BossMetaConfig[]>(cacheKey);
    if (cached) {
      const ageMs = Date.now() - cached.timestamp;
      const differenceInWeeks = ageMs / (1000 * 60 * 60 * 24 * 7);
      if (differenceInWeeks < 1) {
        return cached.data;
      }
    }

    const rates = await client.efficiency.getEHBRates(eat);
    setStorageCache(cacheKey, rates);
    return rates;
  }

  async getEhpRates(eat: EfficiencyAlgorithmType): Promise<SkillMetaConfig[]> {
    if (!this.isBrowser) throw new Error('API calls can only be made in a browser environment with localStorage support.');
    const cacheKey = `ehp_${eat}`;
    const cached = getStorageCache<SkillMetaConfig[]>(cacheKey);
    if (cached) {
      const ageMs = Date.now() - cached.timestamp;
      const differenceInWeeks = ageMs / (1000 * 60 * 60 * 24 * 7);
      if (differenceInWeeks < 1) {
        return cached.data;
      }
    }

    const rates = await client.efficiency.getEHPRates(eat);
    setStorageCache(cacheKey, rates);
    return rates;
  }

  async getPlayerGroups(playerName: string): Promise<GroupResponse[]> {
    if (!this.isBrowser) throw new Error('API calls can only be made in a browser environment with localStorage support.');
    const groups = await client.players.getPlayerGroups(playerName);
    return groups.map((membership) => membership.group);
  }

  async getHiscoreForMetric(groupId: number, metric: Metric, player: PlayerDetailsResponse, limit = 25): Promise<Score> {
    if (!this.isBrowser) throw new Error('API calls can only be made in a browser environment with localStorage support.');

    const hiscores = await client.groups.getGroupHiscores(groupId, metric, { limit });

    const idx = hiscores.findIndex(h => h.player.displayName === player.displayName);

    // Retry with extended limit if player not found
    if (idx === -1 && limit < 500) {
      const newLimit = Math.min(limit * 2, 500);
      console.log(`Player not found with limit ${limit}, retrying with limit ${newLimit}...`);
      return this.getHiscoreForMetric(groupId, metric, player, newLimit);
    }

    const ranking = idx + 1 || 'N/A';

    console.log(`${player.displayName} is ranked ${ranking} in the group for ${metric}!`);

    if (idx === -1) {
      console.warn(`Player ${player.displayName} not found in the hiscores for metric ${metric}.`);
      return {
        metric,
        ranking,
        value: 'N/A',
        first: {
          value: 'N/A',
          difference: 'N/A',
          player: 'N/A',
          timeToFirst: 'N/A'
        },
        next: {
          value: 'N/A',
          difference: 'N/A',
          player: 'N/A',
          timeToNext: 'N/A',
        },
      };
    } else {
      return {
        metric,
        ranking,
        value: this.getValue(hiscores[idx]),
        first: {
          value: this.getValue(hiscores[0]),
          difference: idx === 0 ? 0 : this.metricDifference(hiscores[idx], hiscores[0], metric),
          player: hiscores[0].player.displayName,
          timeToFirst: idx === 0 ? 'N/A' : await this.computeTimeBetweenScores(hiscores[idx], hiscores[0], metric, player.build)
        },
        next: {
          value: idx === 0 ? 'N/A' : this.getValue(hiscores[idx - 1]),
          difference: idx === 0 ? 0 : this.metricDifference(hiscores[idx], hiscores[idx - 1], metric),
          player: idx === 0 ? '' : hiscores[idx - 1].player.displayName,
          timeToNext: idx === 0 ? 'N/A' : await this.computeTimeBetweenScores(hiscores[idx], hiscores[idx - 1], metric, player.build)
        }
      };
    }
  }

  async computeTimeBetweenScores(playerHiscore: GroupHiscoresEntryResponse, otherPlayerHiscore: GroupHiscoresEntryResponse, metric: Metric, playerBuild: PlayerBuild): Promise<number | 'N/A'> {
    if (!this.isBrowser) throw new Error('API calls can only be made in a browser environment with localStorage support.');
    const playerValue = this.getValue(playerHiscore);
    const nextPlayerValue = this.getValue(otherPlayerHiscore);

    if (typeof playerValue !== 'number' || typeof nextPlayerValue !== 'number') {
      return 'N/A';
    }

    const valueDifference = this.metricDifference(playerHiscore, otherPlayerHiscore, metric);

    if (valueDifference === 'N/A' || valueDifference <= 0) {
      return 'N/A';
    }

    if (this.isSkillMetric(metric)) {
      const ehpRates = await this.getEhpRates(playerBuild as unknown as EfficiencyAlgorithmType);
      const skillConfig = ehpRates.find(config => config.skill === metric) as SkillMetaConfig;
      if (!skillConfig) {
        return 'N/A';
      }
      return this.computeTimeBetweenSkills(playerHiscore.data ? (playerHiscore.data as GroupHiscoresSkillData).experience : 0, otherPlayerHiscore.data ? (otherPlayerHiscore.data as GroupHiscoresSkillData).experience : 0, skillConfig);
    } else if (this.isBossMetric(metric)) {
      const ehbRates = await this.getEhbRates(playerBuild as unknown as EfficiencyAlgorithmType);
      const bossConfig = ehbRates.find(config => config.boss === metric) as BossMetaConfig;
      if (!bossConfig) {
        return 'N/A';
      }
      return Math.ceil(valueDifference / bossConfig.rate);
    } else if (this.isComputedMetric(metric)) {
      return Math.ceil(valueDifference);
    } return 'N/A';
  }

  computeTimeBetweenSkills(start: number, end: number, meta: SkillMetaConfig): number {
    let totalTime = 0;
    for (const [key, method] of meta.methods.entries()) {
      const isLastMethod: boolean = key === meta.methods.length - 1;
      if (isLastMethod) {
        totalTime += (end - method.startExp) / method.rate;
      } else if (start < method.startExp) {
        const nextMethod = meta.methods[key + 1];
        const effectiveStartExp = Math.max(start, method.startExp);
        const effectiveEndExp = Math.min(end, nextMethod.startExp);
        if (effectiveEndExp > effectiveStartExp) {
          totalTime += (effectiveEndExp - effectiveStartExp) / method.rate;
        }
      }
    }
    return totalTime;
  }

  getValue(hiscore: GroupHiscoresEntryResponse): number | 'N/A' {
    if (hiscore.data === null) {
      return 'N/A';
    }
    if ('experience' in hiscore.data) {
      return hiscore.data.experience;
    } else if ('kills' in hiscore.data) {
      return hiscore.data.kills;
    } else if ('score' in hiscore.data) {
      return hiscore.data.score;
    } else if ('value' in hiscore.data) {
      return hiscore.data.value;
    }
    return 'N/A';
  }

  metricDifference(playerHiscore: GroupHiscoresEntryResponse, nextPlayerHiscore: GroupHiscoresEntryResponse, metric: Metric): number | 'N/A' {
    if (this.isSkillMetric(metric)) {
      const playerData = playerHiscore.data as GroupHiscoresSkillData;
      const nextPlayerData = nextPlayerHiscore.data as GroupHiscoresSkillData;
      // console.log('playerData', playerData);
      // console.log('nextPlayerData', nextPlayerData);
      if (!playerData || !nextPlayerData) {
        return 'N/A';
      }
      return nextPlayerData.experience - playerData.experience;
    } else if (this.isBossMetric(metric)) {
      const playerData = playerHiscore.data as GroupHiscoresBossData;
      const nextPlayerData = nextPlayerHiscore.data as GroupHiscoresBossData;
      // console.log('playerData', playerData);
      // console.log('nextPlayerData', nextPlayerData);
      if (!playerData || !nextPlayerData) {
        return 'N/A';
      }
      return nextPlayerData.kills - playerData.kills;
    } else if (this.isActivityMetric(metric)) {
      const playerData = playerHiscore.data as GroupHiscoresActivityData;
      const nextPlayerData = nextPlayerHiscore.data as GroupHiscoresActivityData;
      // console.log('playeqrData', playerData);
      // console.log('nextPlayerData', nextPlayerData);
      if (!playerData || !nextPlayerData) {
        return 'N/A';
      }
      return nextPlayerData.score - playerData.score;
    } else if (this.isComputedMetric(metric)) {
      const playerData = playerHiscore.data as GroupHiscoresComputedMetricData;
      const nextPlayerData = nextPlayerHiscore.data as GroupHiscoresComputedMetricData;
      // console.log('playerData', playerData);
      // console.log('nextPlayerData', nextPlayerData);
      if (!playerData || !nextPlayerData) {
        return 'N/A';
      }
      return nextPlayerData.value - playerData.value;
    }
    return 'N/A';
  }

  isSkillMetric(metric: Metric): boolean {
    return Object.values(Skill).includes(metric as Skill);
  }

  isBossMetric(metric: Metric): boolean {
    return Object.values(Boss).includes(metric as Boss);
  }

  isActivityMetric(metric: Metric): boolean {
    return Object.values(Activity).includes(metric as Activity);
  }

  isComputedMetric(metric: Metric): boolean {
    return Object.values(ComputedMetric).includes(metric as ComputedMetric);
  }
}
