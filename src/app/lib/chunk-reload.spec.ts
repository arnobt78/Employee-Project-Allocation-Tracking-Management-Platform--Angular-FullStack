import { isChunkLoadError, reloadForStaleChunk } from './chunk-reload';

describe('chunk-reload', () => {
  const memoryStorage = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
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
    const storage = memoryStorage();
    const navigate = jasmine.createSpy('navigate');
    const error = new Error('Loading chunk 645 failed.');

    expect(reloadForStaleChunk(error, '/api-status', storage, navigate, 1_000)).toBeTrue();
    expect(navigate).toHaveBeenCalledOnceWith('/api-status');

    expect(reloadForStaleChunk(error, '/api-status', storage, navigate, 5_000)).toBeFalse();
    expect(navigate).toHaveBeenCalledTimes(1);

    expect(reloadForStaleChunk(error, '/api-status', storage, navigate, 20_000)).toBeTrue();
  });

  it('ignores non-chunk errors', () => {
    const navigate = jasmine.createSpy('navigate');
    expect(
      reloadForStaleChunk(new Error('boom'), '/x', memoryStorage(), navigate)
    ).toBeFalse();
    expect(navigate).not.toHaveBeenCalled();
  });
});
