// 准星代码解析器（服务端解析 → 渲染参数结构，CrosshairPreview 与单测共用）
// 代码格式：分号分隔的参数段（缺失参数取默认值）；预览为近似渲染，以游戏内导入效果为准
export interface CrosshairRender {
  color: string;
  opacity: number;
  dot: { enabled: boolean; size: number };
  inner: { enabled: boolean; thickness: number; length: number; opacity: number; gap: number };
  outline: { enabled: boolean; thickness: number };
}

const COLOR_MAP: Record<string, string> = {
  '1': '#FFFFFF', '2': '#00FF00', '3': '#B5FF4B', '4': '#00FFFF',
  '5': '#FF00FF', '6': '#FFE469', '7': '#FF0000', '8': '#9C00FF',
};

export function parseCrosshairCode(code: string): CrosshairRender {
  // 段格式 "key;value"，配对解析
  const parts = (code || '').split(';');
  const map = new Map<string, string>();
  for (let i = 0; i + 1 < parts.length; i += 2) {
    map.set(parts[i], parts[i + 1]);
  }
  const num = (k: string, d: number) => {
    const v = Number(map.get(k));
    return Number.isFinite(v) ? v : d;
  };
  const color = COLOR_MAP[map.get('c') ?? ''] ?? '#FFFFFF';
  const thickness = num('0t', 2);
  return {
    color,
    opacity: Math.max(0, Math.min(1, num('o', 1))),
    dot: { enabled: num('d', 0) === 1, size: num('z', 3) },
    inner: {
      // 内线关闭 = 长度与粗细均为 0（游戏中点掉内线即如此编码）
      enabled: !(thickness === 0 && num('0l', 6) === 0),
      thickness: Math.max(1, thickness),
      length: Math.max(0, num('0l', 6)),
      opacity: Math.max(0, Math.min(1, num('0o', 1))),
      gap: num('0a', 3),
    },
    outline: { enabled: num('0f', 0) === 1, thickness: num('1b', 1) },
  };
}