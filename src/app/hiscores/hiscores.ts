import { Component, computed, effect, Inject, OnInit, Optional, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GroupResponse, Metric, Skill, Boss, Activity, ComputedMetric, PlayerDetailsResponse } from '@wise-old-man/utils';
import { WomService, Score, Goal } from '../services/wom.service';
import { DecimalPipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

type ScoreWithCache = {
  score: Score;
  cacheTimestamp: number | null;
  isCached: boolean;
  previousRanking: number | 'N/A' | null;
};

type SortColumn = 'metric' | 'ranking' | 'value' | 'next' | 'first';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-hiscores',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './hiscores.html',
  styleUrl: './hiscores.css',
})
export class Hiscores implements OnInit {

  playerName = signal('');
  playerDetails = signal<PlayerDetailsResponse | null>(null);
  groups = signal<GroupResponse[]>([]);
  selectedGroupId = signal<number | null>(null);
  scores = signal<ScoreWithCache[]>([]);
  sortColumn = signal<SortColumn | null>(null);
  sortDirection = signal<SortDirection>('asc');
  visibleScores = computed(() => this.getSortedScores(this.scores()));
  isLoadingGroups = signal(false);
  isLoadingHiscores = signal(false);
  refreshingMetrics = signal<Set<string>>(new Set());
  isRefreshingAll = signal(false);
  isUpdatingAllGroupMembers = signal(false);
  showUpdateDialog = signal(false);
  verificationCode = signal('');
  toasts = signal<Array<{ id: number; text: string; closing?: boolean }>>([]);
  readonly maxVisibleToasts = 3;
  visibleToasts = computed(() => {
    const all = this.toasts();
    return all.slice(-this.maxVisibleToasts);
  });

  // Update progress signals for individual updates
  updateTotal = signal(0);
  updateCurrentIndex = signal(0);
  updateCurrentName = signal('');
  updateSuccessCount = signal(0);
  updateFailureCount = signal(0);
  updateStartTime = signal<number | null>(null);
  updateEtaSeconds = signal(0);
  isRefreshingSkills = signal(false);
  isRefreshingBosses = signal(false);
  isRefreshingActivities = signal(false);
  isRefreshingComputedMetrics = signal(false);

  readonly appVersion = environment.appVersion;

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
    private router: Router,
    @Optional() @Inject(DOCUMENT) private document: Document | null = null
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
          this.router.navigateByUrl(`/hiscores/${encodeURIComponent(name)}/${groupId}`);
        } else if (name) {
          // console.log(`Navigating to hiscores for player "${name}"...`);
          this.router.navigateByUrl(`/hiscores/${encodeURIComponent(name)}`);
        } else {
          // console.log('Navigating to hiscores main page...');
          this.router.navigateByUrl('/hiscores');
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

  onGroupSelectionChange(value: string | number | null): void {
    this.selectedGroupId.set(value === '' || value === null ? null : Number(value));
    void this.onGroupSelect();
  }

  async onGroupSelect(): Promise<void> {
    if (!this.selectedGroupId() || !this.playerName()) return;

    await this.loadHiscores(this.selectedGroupId()!, this.playerName());
  }

  private getCacheKey(playerName: string, groupId: number, metric: Metric): string {
    return `hiscore_${playerName}_${groupId}_${metric}`;
  }

  private async fetchAndCacheAllScores(groupId: number, playerName: string, playerDetails: PlayerDetailsResponse): Promise<ScoreWithCache[]> {
    const scores = await this.womService.getScoresFromBulkHiscores(groupId, playerDetails);
    const timestamp = Date.now();

    return scores.map(score => {
      const cacheKey = this.getCacheKey(playerName, groupId, score.metric);
      this.setCachedData(cacheKey, score, timestamp);
      return {
        score,
        cacheTimestamp: timestamp,
        isCached: true,
        previousRanking: null,
      };
    });
  }

  private async loadHiscores(groupId: number, playerName: string) {
    this.scores.set([]);
    this.isLoadingHiscores.set(true);

    if (!this.isBrowser) {
      console.error('Cannot fetch player details in a non-browser environment without localStorage support.');
      return;
    }

    const playerDetails: PlayerDetailsResponse = await this.womService.getPlayerDetails(playerName);
    this.playerDetails.set(playerDetails);
    try {
      const cachedScores = Object.values(Metric).map(metric => {
        const cacheKey = this.getCacheKey(playerName, groupId, metric);
        const cached = this.getCachedData<Score>(cacheKey);
        return cached ? {
          score: cached.data,
          cacheTimestamp: cached.timestamp,
          isCached: true,
          previousRanking: null,
        } : null;
      });

      if (cachedScores.every(Boolean)) {
        this.scores.set(cachedScores as ScoreWithCache[]);
        return;
      }

      const fullScores = await this.fetchAndCacheAllScores(groupId, playerName, playerDetails);
      this.scores.set(fullScores);
    } finally {
      this.isLoadingHiscores.set(false);
    }
  }

  sortTable(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.sortColumn.set(column);
    this.sortDirection.set('asc');
  }

  getSortIndicator(column: SortColumn): string {
    if (this.sortColumn() !== column) {
      return '↕';
    }
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  private getSortedScores(scoresToSort: ScoreWithCache[]): ScoreWithCache[] {
    const column = this.sortColumn();
    if (!column) {
      return scoresToSort;
    }

    const direction = this.sortDirection();
    return [...scoresToSort].sort((left, right) => {
      const leftValue = this.getSortValue(left, column);
      const rightValue = this.getSortValue(right, column);

      if (leftValue === rightValue) {
        return 0;
      }

      const comparison = leftValue < rightValue ? -1 : 1;
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  private getSortValue(scoreWithCache: ScoreWithCache, column: SortColumn): string | number {
    switch (column) {
      case 'metric':
        return scoreWithCache.score.metric;
      case 'ranking':
        return typeof scoreWithCache.score.ranking === 'number' ? scoreWithCache.score.ranking : Number.MAX_SAFE_INTEGER;
      case 'value':
        return this.normalizeNumericValue(scoreWithCache.score.value);
      case 'next':
        return this.normalizeNumericValue(scoreWithCache.score.next.timeToGoal);
      case 'first':
        return this.normalizeNumericValue(scoreWithCache.score.first.timeToGoal);
      default:
        return scoreWithCache.score.metric;
    }
  }

  private normalizeNumericValue(value: string | number): number {
    const normalized = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(normalized) ? normalized : Number.MAX_SAFE_INTEGER;
  }

  getCacheAge(cacheTimestamp: number | null): string | null {
    if (!cacheTimestamp) return null;

    const ageMs = Date.now() - cacheTimestamp;
    const totalSeconds = Math.max(0, Math.floor(ageMs / 1000));

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days}d`);
    }

    if (hours > 0) {
      parts.push(`${hours}h`);
    }

    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }

    if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds}s`);
    }

    if (parts.length > 2) {
      return `${parts[0]} ${parts[1]} old`;
    }

    return `${parts.join(' ')} old`;
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

      const freshScores = await this.womService.getScoresFromBulkHiscores(groupId, this.playerDetails()!);
      const freshScore = freshScores.find(score => score.metric === metricKey) ?? scoreWithCache.score;

      const cacheKey = this.getCacheKey(playerName, groupId, scoreWithCache.score.metric);
      const timestamp = Date.now();
      this.setCachedData(cacheKey, freshScore, timestamp);

      const updatedScores = this.scores().map(s =>
        s.score.metric === metricKey
          ? {
            score: freshScore,
            cacheTimestamp: timestamp,
            isCached: true,
            previousRanking: typeof s.score.ranking === 'number' ? s.score.ranking : null,
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

  private getAssetUrl(assetFile: string): string {
    if (this.document) {
      return new URL(`assets/${assetFile}`, this.document.baseURI).toString();
    }

    return `/assets/${assetFile}`;
  }

  getRankingDeltaIcon(scoreWithCache: ScoreWithCache): string {
    const current = scoreWithCache.score.ranking;
    const previous = scoreWithCache.previousRanking;

    if (typeof current !== 'number' || typeof previous !== 'number') {
      return '';
    }

    if (current < previous) {
      return this.getAssetUrl('arrowup.gif');
    }
    if (current > previous) {
      return this.getAssetUrl('arrowdown.gif');
    }
    return this.getAssetUrl('arrowequal.gif');
  }

  getRankingDeltaText(scoreWithCache: ScoreWithCache): string {
    const current = scoreWithCache.score.ranking;
    const previous = scoreWithCache.previousRanking;

    if (typeof current !== 'number' || typeof previous !== 'number') {
      return '';
    }

    const delta = previous - current;
    if (delta > 0) {
      return `+${delta}`;
    }
    if (delta < 0) {
      return `${delta}`;
    }
    return '0';
  }

  getRankingDeltaAlt(scoreWithCache: ScoreWithCache): string {
    const current = scoreWithCache.score.ranking;
    const previous = scoreWithCache.previousRanking;

    if (typeof current !== 'number' || typeof previous !== 'number') {
      return '';
    }

    if (current < previous) {
      return 'Ranking improved';
    }
    if (current > previous) {
      return 'Ranking worsened';
    }
    return 'Ranking unchanged';
  }

  isRankingImproved(scoreWithCache: ScoreWithCache): boolean {
    const current = scoreWithCache.score.ranking;
    const previous = scoreWithCache.previousRanking;
    return typeof current === 'number' && typeof previous === 'number' && current < previous;
  }

  isRankingWorsened(scoreWithCache: ScoreWithCache): boolean {
    const current = scoreWithCache.score.ranking;
    const previous = scoreWithCache.previousRanking;
    return typeof current === 'number' && typeof previous === 'number' && current > previous;
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
      if (!this.playerDetails()) {
        await this.getPlayerDetails(playerName);
      }

      const freshScores = await this.womService.getScoresFromBulkHiscores(groupId, this.playerDetails()!);
      const timestamp = Date.now();
      const updatedScores = freshScores.map(score => {
        const cacheKey = this.getCacheKey(playerName, groupId, score.metric);
        this.setCachedData(cacheKey, score, timestamp);

        this.refreshingMetrics.update(set => new Set(set).add(score.metric));
        const existing = this.scores().find(s => s.score.metric === score.metric);
        return {
          score,
          cacheTimestamp: timestamp,
          isCached: true,
          previousRanking: existing && typeof existing.score.ranking === 'number' ? existing.score.ranking : null,
        };
      });

      this.scores.set(updatedScores);
    } finally {
      this.refreshingMetrics.set(new Set());
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
      if (!this.playerDetails()) {
        await this.getPlayerDetails(playerName);
      }

      const freshScores = await this.womService.getScoresFromBulkHiscores(groupId, this.playerDetails()!);
      const timestamp = Date.now();
      const updatedScores = freshScores.map(score => {
        const cacheKey = this.getCacheKey(playerName, groupId, score.metric);
        this.setCachedData(cacheKey, score, timestamp);
        const existing = this.scores().find(s => s.score.metric === score.metric);
        return {
          score,
          cacheTimestamp: timestamp,
          isCached: true,
          previousRanking: existing && typeof existing.score.ranking === 'number' ? existing.score.ranking : null,
        };
      });

      const refreshedMetrics = updatedScores
        .filter(s => this.getMetricType(s.score.metric) === metricType)
        .map(s => s.score.metric);

      refreshedMetrics.forEach(metric => {
        this.refreshingMetrics.update(set => new Set(set).add(metric));
      });

      const allScores = this.scores().map(s => {
        if (this.getMetricType(s.score.metric) === metricType) {
          const updated = updatedScores.find(u => u.score.metric === s.score.metric);
          return updated || s;
        }
        return s;
      });

      this.scores.set(allScores);
    } finally {
      this.refreshingMetrics.set(new Set());
      loadingSignal.set(false);
    }
  }

  getUnit(metric: Metric): string {
    if (this.womService.isSkillMetric(metric)) return ' exp';
    if (this.womService.isBossMetric(metric)) return ' kc';
    return '';
  }

  getToolTip(goal: Goal, score: Score): string {
    let string = goal.value !== 'N/A' ? `${new Intl.NumberFormat().format(goal.value)}${this.getUnit(score.metric)} - ${goal.player}` : 'N/A';
    if (goal.difference !== 0) {
      string += `\n+${goal.difference !== 'N/A' ? new Intl.NumberFormat().format(goal.difference) + this.getUnit(score.metric) : 'N/A'}`;
    }
    if (goal.timeToGoal !== 'N/A') {
      string += `\n(${new Intl.NumberFormat(navigator.language, { style: 'unit', unit: 'hour', maximumFractionDigits: 0 }).format(goal.timeToGoal)})`;
    }
    return string;
  }

  onUpdateAllGroupMembersClick(): void {
    if (!this.selectedGroupId()) {
      this.addToast('Please select a group before updating members.');
      return;
    }
    this.showUpdateDialog.set(true);
  }

  closeUpdateDialog(): void {
    this.showUpdateDialog.set(false);
  }

  private addToast(text: string): void {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const current = [...this.toasts()];
    current.push({ id, text, closing: false });
    this.toasts.set(current);

    // Start closing animation after 4600ms, then remove after animation (220ms)
    const closeDelay = 4600;
    const removeDelay = closeDelay + 240;
    setTimeout(() => this.initiateRemoveToast(id), closeDelay);
    setTimeout(() => {
      this.toasts.set(this.toasts().filter(t => t.id !== id));
    }, removeDelay);
  }

  removeToast(id: number): void {
    this.initiateRemoveToast(id);
  }

  private initiateRemoveToast(id: number): void {
    // mark as closing to trigger fade-out animation
    const current = this.toasts();
    if (!current.find(t => t.id === id)) return;
    this.toasts.set(current.map(t => (t.id === id ? { ...t, closing: true } : t)));
    // ensure removal after animation in case caller didn't schedule it
    setTimeout(() => {
      this.toasts.set(this.toasts().filter(t => t.id !== id));
    }, 300);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRateLimitError(err: any): boolean {
    if (!err) return false;
    if (typeof err === 'string') return err.includes('429');
    if (err.status === 429 || err.statusCode === 429) return true;
    if (err.response && (err.response.status === 429 || err.response.statusCode === 429)) return true;
    if (err.message && typeof err.message === 'string' && err.message.includes('429')) return true;
    return false;
  }

  async startGroupUpdate(): Promise<void> {
    const groupId = this.selectedGroupId();
    if (!groupId) {
      this.addToast('No group selected.');
      return;
    }

    this.closeUpdateDialog();
    this.isUpdatingAllGroupMembers.set(true);
    try {
      const verification = this.verificationCode();

      // Retry loop for updateGroup in case of rate limiting
      let attempt = 0;
      const maxAttempts = 10;
      while (true) {
        try {
          const result = await this.womService.updateGroup(groupId, verification);
          const message = (result as any)?.message ?? (result as any)?.count ?? JSON.stringify(result);
          this.addToast(`Group update requested: ${message}`);
          // refresh local scores after a short delay to allow server to process
          await this.sleep(1000);
          await this.refreshAll();
          break;
        } catch (err: any) {
          if (this.isRateLimitError(err)) {
            attempt++;
            if (attempt > maxAttempts) {
              this.addToast('Rate limit persists; aborting group update.');
              break;
            }
            this.addToast('Rate limited by API — pausing 5s, increasing delay and retrying...');
            await this.sleep(5000);
            // increase base sleep for individual updates as well
            // note: startIndividualUpdate will derive its own sleepMs but we persist a larger default by nudging updateEtaSeconds (not ideal)
            continue;
          }
          this.addToast(`Group update failed: ${err?.message ?? err}`);
          break;
        }
      }
    } finally {
      this.isUpdatingAllGroupMembers.set(false);
    }
  }

  async startIndividualUpdate(): Promise<void> {
    const groupId = this.selectedGroupId();
    const playerName = this.playerName();
    if (!groupId || !playerName) {
      this.addToast('Select a group and player before updating members.');
      return;
    }
    this.closeUpdateDialog();
    this.isUpdatingAllGroupMembers.set(true);
    this.updateTotal.set(0);
    this.updateCurrentIndex.set(0);
    this.updateCurrentName.set('');
    this.updateSuccessCount.set(0);
    this.updateFailureCount.set(0);
    this.updateStartTime.set(Date.now());

    try {
      const bulk = await this.womService.getBulkHiscores(groupId);
      const players = bulk.map(b => b.player).filter(p => p && p.displayName) as Array<any>;
      this.updateTotal.set(players.length);

      // per-player loop with rate-limit retries
      let baseSleepMs = 500; // initial 0.5s between calls
      const maxRetries = 10;
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const name = p.displayName;
        this.updateCurrentIndex.set(i + 1);
        this.updateCurrentName.set(name);

        let attempt = 0;
        let succeeded = false;
        while (!succeeded) {
          try {
            await this.womService.updatePlayer(name);
            this.updateSuccessCount.update(n => n + 1);
            succeeded = true;
          } catch (err: any) {
            if (this.isRateLimitError(err)) {
              attempt++;
              if (attempt > maxRetries) {
                this.updateFailureCount.update(n => n + 1);
                this.addToast(`Giving up updating ${name} after ${maxRetries} retries due to rate limiting.`);
                break;
              }
              // on rate limit: pause 5s, increase inter-call delay
              this.addToast(`Rate limited updating ${name} — pausing 5s and increasing delay...`);
              await this.sleep(5000);
              baseSleepMs += 500;
              continue; // retry the same call
            }
            // non-rate-limit error: record failure and stop retrying this player
            this.updateFailureCount.update(n => n + 1);
            this.addToast(`Failed updating ${name}: ${err?.message ?? err}`);
            break;
          }
        }

        // compute ETA using elapsed time and baseSleepMs
        const now = Date.now();
        const elapsed = now - (this.updateStartTime() ?? now);
        const completed = i + 1;
        const avgPer = completed > 0 ? elapsed / completed : baseSleepMs;
        const remaining = Math.max(0, players.length - completed);
        const etaMs = Math.ceil(avgPer * remaining);
        this.updateEtaSeconds.set(Math.ceil(etaMs / 1000));

        // wait between calls
        await this.sleep(baseSleepMs);
      }

      this.addToast(`Finished updating members: ${this.updateSuccessCount()} succeeded, ${this.updateFailureCount()} failed.`);
      // refresh scores to reflect updates
      await this.refreshAll();
    } catch (err: any) {
      this.addToast(`Update process failed: ${err?.message ?? err}`);
    } finally {
      this.isUpdatingAllGroupMembers.set(false);
      this.updateCurrentIndex.set(0);
      this.updateCurrentName.set('');
      this.updateStartTime.set(null);
      this.updateEtaSeconds.set(0);
    }
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }
}
