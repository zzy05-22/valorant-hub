import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as Container } from 'astro/container';
import AgentCard from '../../src/components/AgentCard.astro';

const sampleAgent = {
  id: 'jett',
  uuid: 'u',
  zh: { name: '捷风', description: '', role: '决斗者' },
  en: { name: 'Jett', description: '', role: 'Duelist' },
  roleIcon: '', displayIcon: 'https://example.com/jett.png',
  fullPortrait: '', background: '',
  abilities: [],
};

describe('AgentCard', () => {
  it('渲染中文名、英文名与角色，链接指向详情页', async () => {
    const container = await Container.create();
    const html = await container.renderToString(AgentCard, { props: { agent: sampleAgent } });
    expect(html).toContain('捷风');
    expect(html).toContain('Jett');
    expect(html).toContain('决斗者');
    expect(html).toContain('href="/agents/jett/"');
  });

  it('图片带懒加载与 onerror 降级', async () => {
    const container = await Container.create();
    const html = await container.renderToString(AgentCard, { props: { agent: sampleAgent } });
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('onerror');
  });
});