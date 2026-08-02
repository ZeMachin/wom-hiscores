import { Hiscores } from './hiscores';

describe('Hiscores.getCacheAge', () => {
  let component: Hiscores;

  beforeEach(() => {
    component = new Hiscores({} as any, {} as any, { url: '' } as any);
  });

  it('resolves ranking delta assets from the document base URL', () => {
    const componentWithDocument = new Hiscores({} as any, {} as any, { url: '' } as any, {
      baseURI: 'https://example.com/wom-hiscores/'
    } as Document);

    expect(componentWithDocument.getRankingDeltaIcon({
      score: { ranking: 13 } as any,
      previousRanking: 10,
    } as any)).toBe('https://example.com/wom-hiscores/assets/arrowdown.gif');
  });

  it('shows days and hours when the cache is older than a day', () => {
    spyOn(Date, 'now').and.returnValue(1_700_000_000_000);
    const timestamp = 1_700_000_000_000 - (25 * 60 * 60 * 1000 + 30 * 60 * 1000);

    expect(component.getCacheAge(timestamp)).toBe('1d 2h old');
  });

  it('shows hours and minutes when the cache is older than an hour', () => {
    spyOn(Date, 'now').and.returnValue(1_700_000_000_000);
    const timestamp = 1_700_000_000_000 - (61 * 60 * 1000 + 30 * 1000);

    expect(component.getCacheAge(timestamp)).toBe('1h 2m old');
  });

  it('shows minutes and seconds when the cache is older than a minute', () => {
    spyOn(Date, 'now').and.returnValue(1_700_000_000_000);
    const timestamp = 1_700_000_000_000 - (2 * 60 * 1000 + 5 * 1000);

    expect(component.getCacheAge(timestamp)).toBe('2m 5s old');
  });
});
