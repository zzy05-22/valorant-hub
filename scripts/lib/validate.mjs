// 数据落盘前校验：任何一项不通过即抛 ValidationError，调用方放弃写入（保留旧数据）

export class ValidationError extends Error {}

export function validateAgents(agents) {
  if (!Array.isArray(agents) || agents.length < 20) {
    throw new ValidationError(`agents 数量异常：${agents?.length ?? 0}（预期 ≥ 20）`);
  }
  for (const a of agents) {
    if (!a.id || !a.zh?.name || !a.en?.name) {
      throw new ValidationError(`agent 关键字段缺失：${JSON.stringify(a).slice(0, 200)}`);
    }
    if (!Array.isArray(a.abilities) || a.abilities.length === 0) {
      throw new ValidationError(`agent ${a.id} 技能数据为空`);
    }
  }
  return true;
}

export function validateWeapons(weapons) {
  if (!Array.isArray(weapons) || weapons.length < 15) {
    throw new ValidationError(`weapons 数量异常：${weapons?.length ?? 0}（预期 ≥ 15）`);
  }
  for (const w of weapons) {
    if (!w.id || !w.en?.name) {
      throw new ValidationError(`weapon 关键字段缺失：${JSON.stringify(w).slice(0, 200)}`);
    }
    if (typeof w.credits !== 'number' || w.credits < 0) {
      throw new ValidationError(`weapon ${w.id} 价格异常：${w.credits}`);
    }
  }
  return true;
}