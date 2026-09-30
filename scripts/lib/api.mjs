// valorant-api.com 请求封装：超时 + 指数退避重试
const BASE = 'https://valorant-api.com/v1';
const TIMEOUT_MS = 15000;

export class ApiError extends Error {}

export async function fetchJson(path, { retries = 3, backoffMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new ApiError(`HTTP ${res.status} for ${path}`);
      const body = await res.json();
      if (body.status !== 200) throw new ApiError(`API status ${body.status} for ${path}`);
      return body.data;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export const fetchAgents = (lang) =>
  fetchJson(`/agents?isPlayableCharacter=true&language=${lang}`);
export const fetchWeapons = (lang) => fetchJson(`/weapons?language=${lang}`);
export const fetchVersion = () => fetchJson('/version');
export const fetchMaps = (lang) => fetchJson(`/maps?language=${lang}`);
