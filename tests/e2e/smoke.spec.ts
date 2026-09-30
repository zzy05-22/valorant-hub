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