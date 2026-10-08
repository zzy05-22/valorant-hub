// 准星代码解析器（服务端解析 → 渲染参数结构，CrosshairPreview 与单测共用）
// 代码格式：分号分隔的参数段（缺失参数取默认值）；预览为近似渲染，以游戏内导入效果为准
export interface CrosshairRender {
  color: string;
  opacity: number;
  dot: { enabled: boolean; size: number };
  inner: { enabled: boolean; thickness: number; length: number; vLength: number; opacity: number; gap: number };
  outline: { enabled: boolean; thickness: number };
}

const COLOR_MAP: Record<string, string> = {
  '1': '#FFFFFF', '2': '#00FF00', '3': '#B5FF4B', '4': '#00FFFF',
  '5': '#FF00FF', '6': '#FFE469', '7': '#FF0000', '8': '#9C00FF',
};

export function parseCrosshairCode(code: string): CrosshairRender {
  const parts = (code || '').split(';');
  const map = new Map<string, string>();
  for (let i = 0; i + 1 < parts.length; i += 2) {
    map.set(parts[i], parts[i + 1]);
  }
  const num = (k: string, d: number) => {
    const v = Number(map.get(k));
    return Number.isFinite(v) ? v : d;
  };
  // u;RRGGBBAA 自定义色优先（真实格式的选手准星常用：黑色/粉色/黄绿等）
  const custom = map.get('u');
  const color = custom && /^[0-9A-Fa-f]{6}/.test(custom)
    ? `#${custom.slice(0, 6)}`
    : COLOR_MAP[map.get('c') ?? ''] ?? '#FFFFFF';
  const thickness = num('0t', 2);
  const length = Math.max(0, num('0l', 6));
  return {
    color,
    opacity: Math.max(0, Math.min(1, num('o', 1))),
    dot: { enabled: num('d', 0) === 1, size: num('z', 3) },
    inner: {
      enabled: !(thickness === 0 && length === 0),
      thickness: Math.max(1, thickness),
      length,
      vLength: Math.max(0, num('0v', length)), // 无 0v 时竖线回退横线长度
      opacity: Math.max(0, Math.min(1, num('0o', 1))),
      gap: num('0g', 3), // 真实格式 0g 是间隔；0a 是移动误差系数，忽略不渲染
    },
    outline: { enabled: num('0f', 0) === 1, thickness: num('1b', 1) },
  };
}