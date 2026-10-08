import { describe, expect, it } from 'vitest';
import { parseCrosshairCode } from '../../src/utils/crosshair';

describe('parseCrosshairCode', () => {
  it('解析完整代码：颜色/点/内线/外线参数到位', () => {
    const r = parseCrosshairCode('0;P;c;4;o;1;d;1;z;3;0t;2;0l;6;0o;1;0a;3;0f;1;1b;1');
    expect(r.color).toBe('#00FFFF');
    expect(r.opacity).toBe(1);
    expect(r.dot).toEqual({ enabled: true, size: 3 });
    expect(r.inner).toEqual({ enabled: true, thickness: 2, length: 6, vLength: 6, opacity: 1, gap: 3 });
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

  it('u 段自定义颜色优先于 c 索引（ZmjjKK 黑准星）', () => {
    const r = parseCrosshairCode('0;s;1;P;c;8;u;000000FF;h;0;b;1;0l;3;0v;5;0g;1;0a;1;0f;0;1b;0;S;c;4;s;0.6');
    expect(r.color).toBe('#000000');
    expect(r.inner.vLength).toBe(5);
    expect(r.inner.gap).toBe(1);
  });

  it('0g 是间隔，0a 移动误差被忽略（真实格式）', () => {
    const r = parseCrosshairCode('0;P;c;1;o;1;0t;2;0l;6;0v;4;0g;2;0o;1;0a;1;0f;0;1b;0');
    expect(r.inner.gap).toBe(2);
    expect(r.inner.vLength).toBe(4);
  });

  it('无 0v 时竖线长度回退横线长度', () => {
    const r = parseCrosshairCode('0;P;c;1;o;1;0t;2;0l;6;0g;3;0o;1;0f;0;1b;0');
    expect(r.inner.vLength).toBe(6);
  });

  it('A/S/h/m 等辅助段不影响主准星解析（Demon1 完整代码）', () => {
    const r = parseCrosshairCode('0;p;0;s;1;P;o;1;f;0;0t;1;0l;3;0o;2;0a;1;0f;0;1b;0;A;o;1;0t;1;0l;3;0o;2;0a;1;0f;0;1b;0;S;c;1;o;1');
    expect(r.color).toBe('#FFFFFF');
    expect(r.inner.thickness).toBe(1);
    expect(r.inner.length).toBe(3);
  });
});