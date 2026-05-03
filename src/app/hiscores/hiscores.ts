import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { GroupResponse, Metric, Skill, Boss, Activity, ComputedMetric, PlayerDetailsResponse } from '@wise-old-man/utils';
import { WomService, Score } from '../services/wom.service';
import { TableModule } from 'primeng/table';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from "primeng/button";
import { DividerModule } from 'primeng/divider';

type ScoreWithCache = {
  score: Score;
  cacheTimestamp: number | null;
  isCached: boolean;
};

@Component({
  selector: 'app-hiscores',
  imports: [TableModule, DecimalPipe, FormsModule, SelectModule, ButtonModule, DividerModule],
  templateUrl: './hiscores.html',
  styleUrl: './hiscores.css',
})
export class Hiscores implements OnInit {

  playerName = signal('');
  playerDetails = signal<PlayerDetailsResponse | null>(null);
  groups = signal<GroupResponse[]>([]);
  selectedGroupId = signal<number | null>(null);
  scores = signal<ScoreWithCache[]>([]);
  isLoadingGroups = signal(false);
  isLoadingHiscores = signal(false);
  refreshingMetrics = signal<Set<string>>(new Set());
  isRefreshingAll = signal(false);
  isRefreshingSkills = signal(false);
  isRefreshingBosses = signal(false);
  isRefreshingActivities = signal(false);
  isRefreshingComputedMetrics = signal(false);

  readonly title = signal('wom-hiscores');

  private isInitializing = true;

  private isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

  private getCachedData<T>(cacheKey: string): { data: T; timestamp: number } | null {
    if (!this.isBrowser) {
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

  private setCachedData(cacheKey: string, data: unknown, timestamp: number): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp }));
  }

  constructor(
    private activatedRoute: ActivatedRoute,
    private womService: WomService,
    private router: Router
  ) {
    // Update URL whenever playerName or selectedGroupId changes
    effect(() => {
      const name = this.playerName();
      const groupId = this.selectedGroupId();

      // console.log('Player name:', name);
      // console.log('Selected group ID:', groupId);

      // Skip navigation during initialization
      if (this.isInitializing) return;

      // Construct the target URL
      let targetUrl: string;
      if (name && groupId) {
        targetUrl = `/hiscores/${name}/${groupId}`;
      } else if (name) {
        targetUrl = `/hiscores/${name}`;
      } else {
        targetUrl = '/hiscores';
      }

      // Only navigate if the target URL is different from the current URL
      const routerUrl = this.router.url.split('?')[0].replace('%20', ' ');
      if (routerUrl !== targetUrl) {
        // console.log('router url:', routerUrl, 'targetUrl:', targetUrl);
        if (name && groupId) {
          // console.log(`Navigating to hiscores for player "${name}" and group ID ${groupId}...`);
          this.router.navigate(['hiscores', name, groupId]);
        } else if (name) {
          // console.log(`Navigating to hiscores for player "${name}"...`);
          this.router.navigate(['hiscores', name]);
        } else {
          // console.log('Navigating to hiscores main page...');
          this.router.navigate(['hiscores']);
        }
      }
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }
    // Read initial values from route parameters
    this.activatedRoute.params.subscribe(params => {
      const playerName = params['playerName'];
      const groupId = params['groupId'];

      // console.log('Route params changed:', params);

      if (playerName && this.playerName() !== playerName) {
        this.playerName.set(playerName);
        this.onPlayerNameSubmit(false);
      }

      if (groupId && this.selectedGroupId() !== Number(groupId)) {
        this.selectedGroupId.set(Number(groupId));
        // console.log('selected group id set to:', groupId);
        // console.log('current selected group id:', this.selectedGroupId());

        // Load hiscores if both playerName and groupId are available
        if (playerName || this.playerName()) {
          const nameToUse = playerName || this.playerName();
          this.loadHiscores(Number(groupId), nameToUse);
        }
      }
      // Allow navigation after initial setup
      this.isInitializing = false;
    });

  }

  async getPlayerDetails(playerName: string): Promise<void> {
    const playerDetails: PlayerDetailsResponse = await this.womService.getPlayerDetails(playerName);
    this.playerDetails.set(playerDetails);
  }

  async onPlayerNameSubmit(resetGroupId: boolean = true): Promise<void> {
    if (!this.playerName()) return;

    this.isLoadingGroups.set(true);
    try {
      if (!this.isBrowser) {
        console.error('Cannot fetch player details in a non-browser environment without localStorage support.');
        return;
      }
      const fetchedGroups = await this.womService.getPlayerGroups(this.playerName());
      this.groups.set(fetchedGroups);
      if (resetGroupId) {
        // console.log('set select group id to null');
        this.selectedGroupId.set(null);
        this.scores.set([]);
      }
    } finally {
      this.isLoadingGroups.set(false);
    }
  }

  async onGroupSelect(): Promise<void> {
    if (!this.selectedGroupId() || !this.playerName()) return;

    await this.loadHiscores(this.selectedGroupId()!, this.playerName());
  }

  private async loadHiscores(groupId: number, playerName: string) {
    const scores: ScoreWithCache[] = [];
    this.scores.set([]);
    this.isLoadingHiscores.set(true);

    if (!this.isBrowser) {
      console.error('Cannot fetch player details in a non-browser environment without localStorage support.');
      return;
    }

    const playerDetails: PlayerDetailsResponse = await this.womService.getPlayerDetails(playerName);
    this.playerDetails.set(playerDetails);
    try {
      for (const metric of Object.values(Metric)) {
        const cacheKey = `hiscore_${playerName}_${groupId}_${metric}`;
        const cached = this.getCachedData<Score>(cacheKey);

        if (cached) {
          scores.push({
            score: cached.data,
            cacheTimestamp: cached.timestamp,
            isCached: true,
          });
          this.scores.set([...scores]);
          continue;
        }

        // Fetch and cache
        const score = await this.womService.getHiscoreForMetric(groupId, metric, playerDetails);
        const timestamp = Date.now();
        scores.push({
          score,
          cacheTimestamp: timestamp,
          isCached: true,
        });
        this.setCachedData(cacheKey, score, timestamp);
        this.scores.set([...scores]);

        // Add delay to avoid overloading the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } finally {
      this.isLoadingHiscores.set(false);
    }
  }

  getCacheAge(cacheTimestamp: number | null): string | null {
    if (!cacheTimestamp) return null;
    const ageMs = Date.now() - cacheTimestamp;
    const ageMinutes = Math.floor(ageMs / 1000 / 60);
    const ageSeconds = Math.floor((ageMs / 1000) % 60);

    if (ageMinutes > 0) {
      return `${ageMinutes}m ${ageSeconds}s old`;
    }
    return `${ageSeconds}s old`;
  }

  isRefreshDisabled(cacheTimestamp: number | null): boolean {
    if (!cacheTimestamp) return false;
    const ageMs = Date.now() - cacheTimestamp;
    const ageMinutes = ageMs / 1000 / 60;
    return ageMinutes < 10;
  }

  async refreshScore(scoreWithCache: ScoreWithCache): Promise<void> {
    const metricKey = scoreWithCache.score.metric;
    this.refreshingMetrics.update(set => new Set(set).add(metricKey));

    try {
      const playerName = this.playerName();
      const groupId = this.selectedGroupId();

      if (!playerName || !groupId) return;

      if (!this.playerDetails()) {
        await this.getPlayerDetails(playerName);
      }

      const freshScore = await this.womService.getHiscoreForMetric(
        groupId,
        scoreWithCache.score.metric,
        this.playerDetails()!
      );

      const cacheKey = `hiscore_${playerName}_${groupId}_${scoreWithCache.score.metric}`;
      const timestamp = Date.now();
      this.setCachedData(cacheKey, freshScore, timestamp);

      // Update the score in the list
      const updatedScores = this.scores().map(s =>
        s.score.metric === metricKey
          ? {
            score: freshScore,
            cacheTimestamp: timestamp,
            isCached: true,
          }
          : s
      );
      this.scores.set(updatedScores);
    } finally {
      this.refreshingMetrics.update(set => {
        const newSet = new Set(set);
        newSet.delete(metricKey);
        return newSet;
      });
    }
  }

  getRankColor(scoreWithCache: ScoreWithCache): string {
    const score = scoreWithCache.score;
    if (typeof score.ranking !== 'number' || score.ranking < 1) {
      return 'inherit';
    }

    const scoresArray = this.scores();
    const numericRanks = scoresArray
      .filter((current): current is ScoreWithCache & { score: Score & { ranking: number } } =>
        typeof current.score.ranking === 'number'
      )
      .map(s => s.score);
    const maxRank = numericRanks.length ? Math.max(...numericRanks.map(current => current.ranking)) : 1;
    if (maxRank <= 1) {
      return 'hsl(120, 100%, 50%)';
    }

    const normalized = Math.log(score.ranking) / Math.log(maxRank);
    const hue = 120 - 120 * Math.min(Math.max(normalized, 0), 1);
    return `hsl(${hue}, 80%, 50%)`;
  }

  private getMetricType(metric: Metric): 'skill' | 'boss' | 'activity' | 'computed' | null {
    if (Object.values(Skill).includes(metric as Skill)) return 'skill';
    if (Object.values(Boss).includes(metric as Boss)) return 'boss';
    if (Object.values(Activity).includes(metric as Activity)) return 'activity';
    if (Object.values(ComputedMetric).includes(metric as ComputedMetric)) return 'computed';
    return null;
  }

  private getScoresByMetricType(metricType: 'skill' | 'boss' | 'activity' | 'computed'): ScoreWithCache[] {
    return this.scores().filter(s => this.getMetricType(s.score.metric) === metricType);
  }

  async refreshAll(): Promise<void> {
    const playerName = this.playerName();
    const groupId = this.selectedGroupId();

    if (!playerName || !groupId) return;

    this.isRefreshingAll.set(true);

    try {
      const scoresToRefresh = this.scores();
      const updatedScores: ScoreWithCache[] = [];

      for (const scoreWithCache of scoresToRefresh) {
        this.refreshingMetrics.update(set => new Set(set).add(scoreWithCache.score.metric));

        if (!this.playerDetails()) {
          await this.getPlayerDetails(playerName);
        }

        try {
          const freshScore = await this.womService.getHiscoreForMetric(
            groupId,
            scoreWithCache.score.metric,
            this.playerDetails()!
          );

          const cacheKey = `hiscore_${playerName}_${groupId}_${scoreWithCache.score.metric}`;
          const timestamp = Date.now();
          localStorage.setItem(cacheKey, JSON.stringify({ data: freshScore, timestamp }));

          updatedScores.push({
            score: freshScore,
            cacheTimestamp: timestamp,
            isCached: true,
          });

          await new Promise(resolve => setTimeout(resolve, 500));
        } finally {
          this.refreshingMetrics.update(set => {
            const newSet = new Set(set);
            newSet.delete(scoreWithCache.score.metric);
            return newSet;
          });
        }
      }

      this.scores.set(updatedScores);
    } finally {
      this.isRefreshingAll.set(false);
    }
  }

  async refreshByMetricType(metricType: 'skill' | 'boss' | 'activity' | 'computed'): Promise<void> {
    const playerName = this.playerName();
    const groupId = this.selectedGroupId();

    if (!playerName || !groupId) return;

    const loadingSignal =
      metricType === 'skill' ? this.isRefreshingSkills :
        metricType === 'boss' ? this.isRefreshingBosses :
          metricType === 'activity' ? this.isRefreshingActivities :
            this.isRefreshingComputedMetrics;

    loadingSignal.set(true);

    try {
      const scoresToRefresh = this.getScoresByMetricType(metricType);
      const updatedScores: ScoreWithCache[] = [];

      for (const scoreWithCache of scoresToRefresh) {
        this.refreshingMetrics.update(set => new Set(set).add(scoreWithCache.score.metric));

        if (!this.playerDetails()) {
          await this.getPlayerDetails(playerName);
        }

        try {
          const freshScore = await this.womService.getHiscoreForMetric(
            groupId,
            scoreWithCache.score.metric,
            this.playerDetails()!
          );

          const cacheKey = `hiscore_${playerName}_${groupId}_${scoreWithCache.score.metric}`;
          const timestamp = Date.now();
          localStorage.setItem(cacheKey, JSON.stringify({ data: freshScore, timestamp }));

          updatedScores.push({
            score: freshScore,
            cacheTimestamp: timestamp,
            isCached: true,
          });

          await new Promise(resolve => setTimeout(resolve, 500));
        } finally {
          this.refreshingMetrics.update(set => {
            const newSet = new Set(set);
            newSet.delete(scoreWithCache.score.metric);
            return newSet;
          });
        }
      }

      // Merge with existing scores
      const allScores = this.scores().map(s => {
        const metricTypeOfScore = this.getMetricType(s.score.metric);
        if (metricTypeOfScore === metricType) {
          const updated = updatedScores.find(u => u.score.metric === s.score.metric);
          return updated || s;
        }
        return s;
      });

      this.scores.set(allScores);
    } finally {
      loadingSignal.set(false);
    }
  }

  getUnit(metric: Metric): string {
    if (this.womService.isSkillMetric(metric)) return ' exp';
    if (this.womService.isBossMetric(metric)) return ' kc';
    return '';
  }
}
