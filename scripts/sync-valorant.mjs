// 数据同步 CLI：valorant-api.com → src/data/*.json
// 手动运行：pnpm sync；CI 每日 cron 也会运行（见 .github/workflows/ci.yml）
// 失败策略：校验不通过或网络失败 → 保留旧数据，退出码 1
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fetchAgents, fetchWeapons, fetchVersion } from './lib/api.mjs';
import { transformAgents, transformWeapons } from './lib/transform.mjs';
import { validateAgents, validateWeapons } from './lib/validate.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

// 原子写入：先写临时文件再 rename，中断不会产生半截 JSON
async function atomicWrite(file, data) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`);
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await rename(tmp, file);
}

async function main() {
  console.log('[sync] 拉取 valorant-api.com …');
  const [agentsZh, agentsEn, weaponsZh, weaponsEn, versionRaw] = await Promise.all([
    fetchAgents('zh-CN'),
    fetchAgents('en-US'),
    fetchWeapons('zh-CN'),
    fetchWeapons('en-US'),
    fetchVersion(),
  ]);

  const agents = transformAgents(agentsZh, agentsEn);
  const weapons = transformWeapons(weaponsZh, weaponsEn);
  validateAgents(agents);
  validateWeapons(weapons);

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
  await atomicWrite(path.join(DATA_DIR, 'version.json'), version);

  console.log(`[sync] 完成：agents=${agents.length} weapons=${weapons.length} version=${version.versionNumber}`);
}

main().catch((err) => {
  console.error('[sync] 失败：', err.message);
  console.error('[sync] 已保留旧数据，未写入任何文件。');
  process.exit(1);
});