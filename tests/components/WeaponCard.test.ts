import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as Container } from 'astro/container';
import WeaponCard from '../../src/components/WeaponCard.astro';

const mkWeapon = (over: Record<string, unknown> = {}) => ({
  id: 'vandal',
  uuid: 'u',
  zh: { name: '暴徒', category: '步枪' },
  en: { name: 'Vandal', category: 'Rifle' },
  category: 'EEquippableCategory::Rifle',
  credits: 2900,
  displayIcon: 'https://example.com/vandal.png',
  stats: { fireRate: 9.75, magazineSize: 25, wallPenetration: 'Medium' },
  damageRanges: [],
  ...over,
});

describe('WeaponCard', () => {
  it('中英文名都显示且链接正确', async () => {
    const container = await Container.create();
    const html = await container.renderToString(WeaponCard, { props: { weapon: mkWeapon() } });
    expect(html).toContain('暴徒');
    expect(html).toContain('Vandal');
    expect(html).toContain('href="/weapons/vandal/"');
  });

  it('中英文名相同时只显示一个（如武器 API 未提供中文译名）', async () => {
    const container = await Container.create();
    const html = await container.renderToString(WeaponCard, {
      props: { weapon: mkWeapon({ zh: { name: 'Vandal', category: '步枪' } }) },
    });
    // img 的 alt 属性也含武器名，须只断言显示文本
    const shown = html.match(/class="[^"]*weapon-card__name[^"]*"[^>]*>([^<]+)</);
    expect(shown?.[1]?.trim()).toBe('Vandal');
  });

  it('价格显示信用点', async () => {
    const container = await Container.create();
    const html = await container.renderToString(WeaponCard, { props: { weapon: mkWeapon() } });
    expect(html).toContain('2900 信用点');
  });
});