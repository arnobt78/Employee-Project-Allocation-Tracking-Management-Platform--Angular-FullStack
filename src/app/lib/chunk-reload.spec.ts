import {
  ChunkReloadDeps,
  isChunkLoadError,
  reloadForStaleChunk,
} from './chunk-reload';

describe('chunk-reload', () => {
  const fakeDeps = (at: { now: number }): ChunkReloadDeps & {
    navigate: jasmine.Spy;
  } => {
    const data = new Map<string, string>();
    return {
      storage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
      },
      navigate: jasmine.createSpy('navigate'),
      now: () => at.now,
    };
  };

  it('recognizes webpack and native dynamic import failures', () => {
    const webpack = new Error('Loading chunk 645 failed.\n(error: /645.js)');
    webpack.name = 'ChunkLoadError';
    expect(isChunkLoadError(webpack)).toBeTrue();
    expect(
      isChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: /a.js')
      )
    ).toBeTrue();
    expect(isChunkLoadError(new Error('NG04002: Cannot match any routes'))).toBeFalse();
  });

  it('reloads once to the target url, then backs off', () => {
    const clock = { now: 1_000 };
    const deps = fakeDeps(clock);
    const error = new Error('Loading chunk 645 failed.');

    expect(reloadForStaleChunk(error, '/api-status', deps)).toBeTrue();
    expect(deps.navigate).toHaveBeenCalledOnceWith('/api-status');

    clock.now = 5_000;
    expect(reloadForStaleChunk(error, '/api-status', deps)).toBeFalse();
    expect(deps.navigate).toHaveBeenCalledTimes(1);

    clock.now = 20_000;
    expect(reloadForStaleChunk(error, '/api-status', deps)).toBeTrue();
  });

  it('ignores non-chunk errors', () => {
    const deps = fakeDeps({ now: 0 });
    expect(reloadForStaleChunk(new Error('boom'), '/x', deps)).toBeFalse();
    expect(deps.navigate).not.toHaveBeenCalled();
  });
});
