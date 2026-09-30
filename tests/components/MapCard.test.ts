import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as Container } from 'astro/container';
import MapCard from '../../src/components/MapCard.astro';

const sampleMap = {
  id: 'ascent', uuid: 'u',
  zh: { name: '亚海悬城', description: '', tacticalDescription: '' },
  en: { name: 'Ascent', description: '', tacticalDescription: '' },
  coordinates: "45°26'33\" N, 12°20'18\" E", displayIcon: 'https://example.com/ascent.png', splash: '',
};

describe('MapCard', () => {
  it('渲染中英文名、坐标并链接到详情页', async () => {
    const container = await Container.create();
    const html = await container.renderToString(MapCard, { props: { map: sampleMap } });
    expect(html).toContain('亚海悬城');
    expect(html).toContain('Ascent');
    expect(html).toContain('href="/maps/ascent/"');
  });

  it('战术图懒加载与 onerror 降级', async () => {
    const container = await Container.create();
    const html = await container.renderToString(MapCard, { props: { map: sampleMap } });
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('onerror');
  });
});