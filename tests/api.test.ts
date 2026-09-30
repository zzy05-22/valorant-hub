import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchAgents, fetchWeapons, fetchVersion } from '../scripts/lib/api.mjs';

const okBody = (data: unknown) => ({ status: 200, data });

function mockFetchSequence(responses: Array<Response | Error>) {
  let i = 0;
  const fn = vi.fn(async () => {
    const r = responses[i++];
    if (r instanceof Error) throw r;
    return r;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('成功时返回 data 字段', async () => {
    mockFetchSequence([jsonResponse(okBody([{ hello: 1 }]))]);
    const data = await fetchJson('/demo');
    expect(data).toEqual([{ hello: 1 }]);
  });

  it('前两次失败后重试成功（指数退避）', async () => {
    const fn = mockFetchSequence([
      new Error('network down'),
      new Error('network down again'),
      jsonResponse(okBody(['ok'])),
    ]);
    const data = await fetchJson('/demo', { retries: 3, backoffMs: 1 });
    expect(data).toEqual(['ok']);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('超过重试上限后抛错', async () => {
    // retries: 2 意味着共发起 3 次 fetch，mock 需提供 3 个失败响应（避免 mock 耗尽返回 undefined）
    mockFetchSequence([new Error('always down'), new Error('always down'), new Error('always down')]);
    await expect(
      fetchJson('/demo', { retries: 2, backoffMs: 1 }),
    ).rejects.toThrow('always down');
  });

  it('HTTP 非 200 直接抛错', async () => {
    mockFetchSequence([jsonResponse({ error: 'nope' }, 500)]);
    await expect(fetchJson('/demo', { retries: 0 })).rejects.toThrow('HTTP 500');
  });
});

describe('端点封装', () => {
  it('fetchAgents 带 isPlayableCharacter 与语言参数', async () => {
    const fn = mockFetchSequence([jsonResponse(okBody([]))]);
    await fetchAgents('zh-CN');
    const url = fn.mock.calls[0][0] as string;
    expect(url).toContain('isPlayableCharacter=true');
    expect(url).toContain('language=zh-CN');
  });

  it('fetchWeapons 带语言参数', async () => {
    const fn = mockFetchSequence([jsonResponse(okBody([]))]);
    await fetchWeapons('en-US');
    expect((fn.mock.calls[0][0] as string)).toContain('language=en-US');
  });

  it('fetchVersion 不带语言', async () => {
    const fn = mockFetchSequence([jsonResponse(okBody({}))]);
    await fetchVersion();
    expect((fn.mock.calls[0][0] as string)).toMatch(/\/version$/);
  });
});
