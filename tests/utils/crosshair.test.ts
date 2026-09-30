import { describe, expect, it } from 'vitest';
import { parseCrosshairCode } from '../../src/utils/crosshair';

describe('parseCrosshairCode', () => {
  it('解析完整代码：颜色/点/内线/外线参数到位', () => {
    const r = parseCrosshairCode('0;P;c;4;o;1;d;1;z;3;0t;2;0l;6;0o;1;0a;3;0f;1;1b;1');
    expect(r.color).toBe('#00FFFF');
    expect(r.opacity).toBe(1);
    expect(r.dot).toEqual({ enabled: true, size: 3 });
    expect(r.inner).toEqual({ enabled: true, thickness: 2, length: 6, opacity: 1, gap: 3 });
    expect(r.outline).toEqual({ enabled: true, thickness: 1 });
  });

  it('缺失参数取默认值（白色小点准星）', () => {
    const r = parseCrosshairCode('0;P;c;1;d;1;z;3');
    expect(r.color).toBe('#FFFFFF');
    expect(r.dot.enabled).toBe(true);
    expect(r.inner.thickness).toBe(2); // 默认粗细 2
  });

  it('颜色索引 6 映射黄色', () => {
    expect(parseCrosshairCode('0;P;c;6;o;1').color).toBe('#FFE469');
  });

  it('空串与非法输入返回默认白色准星', () => {
    const r = parseCrosshairCode('');
    expect(r.color).toBe('#FFFFFF');
    expect(r.inner.length).toBeGreaterThan(0);
  });
});