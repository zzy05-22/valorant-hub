// 数据同步 CLI：valorant-api.com → src/data/*.json
// 手动运行：pnpm sync；CI 每日 cron 也会运行（见 .github/workflows/ci.yml）
// 失败策略：校验不通过或网络失败 → 保留旧数据，退出码 1
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fetchAgents, fetchWeapons, fetchMaps, fetchVersion } from './lib/api.mjs';
import { transformAgents, transformWeapons, transformMaps } from './lib/transform.mjs';
import { validateAgents, validateWeapons, validateMaps } from './lib/validate.mjs';
import { fetchHtml, parsePlayerStats, parseTeamRanking, validateEsportsStats } from './lib/vlr.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

// 原子写入：先写临时文件再 rename，中断不会产生半截 JSON
async function atomicWrite(file, data) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`);
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await rename(tmp, file);
}

async function main() {
  console.log('[sync] 拉取 valorant-api.com …');
  const [agentsZh, agentsEn, weaponsZh, weaponsEn, mapsZh, mapsEn, versionRaw] = await Promise.all([
    fetchAgents('zh-CN'),
    fetchAgents('en-US'),
    fetchWeapons('zh-CN'),
    fetchWeapons('en-US'),
    fetchMaps('zh-CN'),
    fetchMaps('en-US'),
    fetchVersion(),
  ]);

  const agents = transformAgents(agentsZh, agentsEn);
  const weapons = transformWeapons(weaponsZh, weaponsEn);
  validateAgents(agents);
  validateWeapons(weapons);

  const maps = transformMaps(mapsZh, mapsEn);
  validateMaps(maps);

  const syncedAt = new Date().toISOString();
  // 偏差修正：valorant-api.com /v1/version 实际返回的版本号字段为 version（如 "13.06.00.5590001"），无 versionNumber；兼容两者
  const version = {
    syncedAt,
    versionNumber: versionRaw?.versionNumber ?? versionRaw?.version ?? '',
    buildVersion: versionRaw?.buildVersion ?? '',
  };

  await mkdir(DATA_DIR, { recursive: true });
  await atomicWrite(path.join(DATA_DIR, 'agents.json'), { syncedAt, version: version.versionNumber, agents });
  await atomicWrite(path.join(DATA_DIR, 'weapons.json'), { syncedAt, version: version.versionNumber, weapons });
  await atomicWrite(path.join(DATA_DIR, 'maps.json'), { syncedAt, version: version.versionNumber, maps });
  await atomicWrite(path.join(DATA_DIR, 'version.json'), version);

  // ===== vlr.gg 电竞数据（独立容错：失败不影响游戏数据同步） =====
  try {
    console.log('[sync] 拉取 vlr.gg 电竞数据 …');
    const [statsHtml, rankingHtml] = await Promise.all([
      fetchHtml('https://www.vlr.gg/stats'),
      fetchHtml('https://www.vlr.gg/rankings'),
    ]);
    const players = parsePlayerStats(statsHtml);
    const teams = parseTeamRanking(rankingHtml);
    if (!validateEsportsStats({ players, teams })) {
      throw new Error(`esports 数据校验失败：players=${players.length} teams=${teams.length}`);
    }
    await atomicWrite(path.join(DATA_DIR, 'esports-stats.json'), {
      syncedAt, source: 'vlr.gg', players, teams,
    });
    console.log(`[sync] esports 数据完成：players=${players.length} teams=${teams.length}`);
  } catch (err) {
    console.warn('[sync] vlr.gg 抓取失败（保留旧数据）:', err.message);
  }

  console.log(`[sync] 完成：agents=${agents.length} weapons=${weapons.length} maps=${maps.length} version=${version.versionNumber}`);
}

main().catch((err) => {
  console.error('[sync] 失败：', err.message);
  console.error('[sync] 已保留旧数据，未写入任何文件。');
  process.exit(1);
});