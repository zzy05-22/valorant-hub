import { expect, test } from '@playwright/test';

test('首页可访问且核心入口齐全', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('精准');
  await expect(page.getByRole('link', { name: '浏览特工' })).toBeVisible();
  await expect(page.getByRole('link', { name: '新手教学' })).toBeVisible();
});

test('特工列表 → 特工详情', async ({ page }) => {
  await page.goto('/agents/');
  await expect(page.getByRole('heading', { name: '特工图鉴' })).toBeVisible();
  await page.locator('.agent-card').first().click();
  await expect(page.getByRole('heading', { level: 2, name: '技能' })).toBeVisible();
  await expect(page.locator('.skill').first()).toBeVisible();
});

test('武器列表可访问', async ({ page }) => {
  await page.goto('/weapons/');
  await expect(page.getByRole('heading', { name: '武器库' })).toBeVisible();
  await expect(page.locator('.weapon-card').first()).toBeVisible();
});

test('教学列表 → 文章详情', async ({ page }) => {
  await page.goto('/guides/');
  await expect(page.getByRole('heading', { name: '新手教学' })).toBeVisible();
  await page.locator('.guide-item__title').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('地图列表可访问', async ({ page }) => {
  await page.goto('/maps/');
  await expect(page.getByRole('heading', { name: '地图库' })).toBeVisible();
  await expect(page.locator('.map-card').first()).toBeVisible();
});

test('版本资讯列表 → 文章详情', async ({ page }) => {
  await page.goto('/patch-notes/');
  await expect(page.getByRole('heading', { name: '版本资讯' })).toBeVisible();
  await page.locator('.note-item__title').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('电竞资讯列表可访问', async ({ page }) => {
  await page.goto('/esports/');
  await expect(page.getByRole('heading', { name: '资讯中心' })).toBeVisible();
  await expect(page.locator('.note-item__title').first()).toBeVisible();
});

test('武器对比：勾选武器后出现对比卡', async ({ page }) => {
  await page.goto('/weapons/compare/');
  const boxes = page.getByRole('checkbox');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await expect(page.locator('.compare-card').first()).toBeVisible();
});

test('阵容推荐：生成 5 人平衡阵容', async ({ page }) => {
  await page.goto('/agents/lineup/');
  await page.getByRole('button', { name: '生成阵容' }).click();
  await expect(page.locator('.lineup-card')).toHaveCount(5);
});

test('全站搜索：输入关键词出结果', async ({ page }) => {
  await page.goto('/search/');
  await page.getByPlaceholder('搜索特工、武器、地图、攻略…').fill('捷风');
  await expect(page.locator('.search-result__title').first()).toContainText('捷风');
});

test('地图点位面板：选特工显示点位标记', async ({ page }) => {
  await page.goto('/maps/ascent/');
  await page.locator('.chip-btn').first().click();
  await expect(page.locator('.lineup__item').first()).toBeVisible();
});

test('特工详情页含道具点位面板', async ({ page }) => {
  await page.goto('/agents/sage/');
  await expect(page.getByRole('heading', { name: '道具点位' })).toBeVisible();
  await page.locator('.chip-btn').first().click();
  await expect(page.locator('.lineup__item').first()).toBeVisible();
});

test('标注工具页：选图并点击生成坐标', async ({ page }) => {
  await page.goto('/lineup-tool/');
  await expect(page.getByRole('heading', { name: '点位标注工具' })).toBeVisible();
  await page.locator('#tactic-map').click({ position: { x: 200, y: 150 } });
  await expect(page.locator('#coord-hint')).toContainText('x=');
});