// 阵容推荐纯函数：角色平衡规则（页面 script 与单测共用）
// 规则：四大角色（决斗/先锋/控场/哨卫——zh.role 实测值）各选 1 名，
// 第 5 席优先再补 1 名决斗者；目标池为空时从剩余最满的池取，直至 5 人或选尽。
export interface LineupAgent {
  id: string;
  zhName: string;
  enName: string;
  role: string;
  displayIcon: string;
}

export function buildLineup(agents: LineupAgent[], rng: () => number = Math.random): LineupAgent[] {
  const pools = new Map<string, LineupAgent[]>();
  for (const a of agents) {
    if (!pools.has(a.role)) pools.set(a.role, []);
    pools.get(a.role)!.push(a);
  }

  const picked: LineupAgent[] = [];
  const take = (pool: LineupAgent[]): LineupAgent => {
    const i = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
    return pool.splice(i, 1)[0];
  };

  // 第一轮：每角色各 1 名
  for (const pool of pools.values()) {
    if (picked.length >= 5) break;
    if (pool.length) picked.push(take(pool));
  }
  // 第二轮：第 5 席优先决斗池，空则取剩余最满的池
  while (picked.length < 5) {
    const duelPool = pools.get('决斗');
    const rest = [...pools.values()].filter((p) => p.length);
    if (!rest.length) break;
    const pool = duelPool?.length ? duelPool : rest.sort((a, b) => b.length - a.length)[0];
    picked.push(take(pool!));
  }
  return picked.slice(0, 5);
}