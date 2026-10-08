import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEventAgents, parseEventList, parseMatches, parsePlayerStats, parseTeamRanking, validateEsportsStats } from '../scripts/lib/vlr.mjs';

const statsHtml = readFileSync('tests/fixtures/vlr-stats.html', 'utf8');
const rankingHtml = readFileSync('tests/fixtures/vlr-ranking.html', 'utf8');

describe('parsePlayerStats', () => {
  it('解析出 ≥ 50 行选手且含 N4RRATE 与 rating', () => {
    const players = parsePlayerStats(statsHtml);
    expect(players.length).toBeGreaterThanOrEqual(50);
    const top = players[0];
    expect(['rating', 'acs', 'kd'].some((k) => k in top)).toBe(true);
    expect(players.some((p) => p.name === 'N4RRATE')).toBe(true);
  });
});

describe('parseTeamRanking', () => {
  it('解析出 ≥ 10 支战队且含排名序号', () => {
    const teams = parseTeamRanking(rankingHtml);
    expect(teams.length).toBeGreaterThanOrEqual(10);
    expect(teams[0].rank).toBeLessThan(teams[9].rank);
  });
});

describe('validateEsportsStats', () => {
  it('players ≥ 50 且首行 rating > 1 时通过', () => {
    const players = parsePlayerStats(statsHtml);
    const teams = parseTeamRanking(rankingHtml);
    expect(validateEsportsStats({ players, teams })).toBe(true);
  });
});

describe('parseMatches（赛程赛果）', () => {
  const fixture = `<a href="/754730/a-vs-b" class="wf-module-item match-item mod-color mod-first">
  <div class="match-item-time">5:00 PM</div>
  <div class="match-item-vs">
    <div class="match-item-vs-team ">
      <div class="match-item-vs-team-name"><div class="text-of"><span class="flag mod-us"></span>
        100 Thieves</div></div>
      <div class="match-item-vs-team-score mod-upcoming">&ndash;</div>
    </div>
    <div class="match-item-vs-team ">
      <div class="match-item-vs-team-name"><div class="text-of"><span class="flag mod-us"></span>
        G2 Esports</div></div>
      <div class="match-item-vs-team-score mod-upcoming">&ndash;</div>
    </div>
  </div>
  <div class="match-item-eta"><div class="ml"><div class="ml-status">Upcoming</div><div class="ml-eta">6h 56m</div></div></div>
  <div class="match-item-event text-of">VCT Champions 2026<div class="match-item-event-series text-of">Upper Bracket Quarterfinals</div></div>
  </a>
  <a href="/754731/c-vs-d" class="wf-module-item match-item mod-color">
  <div class="match-item-time">2:00 PM</div>
  <div class="match-item-vs">
    <div class="match-item-vs-team ">
      <div class="match-item-vs-team-name"><div class="text-of"><span class="flag mod-br"></span>
        LOUD</div></div>
      <div class="match-item-vs-team-score mod-win mod-count">2</div>
    </div>
    <div class="match-item-vs-team ">
      <div class="match-item-vs-team-name"><div class="text-of"><span class="flag mod-kr"></span>
        DRX</div></div>
      <div class="match-item-vs-team-score mod-loss mod-count">0</div>
    </div>
  </div>
  <div class="match-item-eta"><div class="ml"><div class="ml-status">Final</div><div class="ml-eta">18h ago</div></div></div>
  <div class="match-item-event text-of">VCT Champions 2026<div class="match-item-event-series text-of">Grand Final</div></div>
  </a>`;

  it('解析进行中/即将比赛：两队与状态', () => {
    const ms = parseMatches(fixture);
    expect(ms).toHaveLength(2);
    expect(ms[0]).toMatchObject({ href: '/754730/a-vs-b', teamA: '100 Thieves', teamB: 'G2 Esports', status: 'upcoming' });
  });

  it('解析已结束比赛：比分与胜者', () => {
    const ms = parseMatches(fixture);
    expect(ms[1]).toMatchObject({ teamA: 'LOUD', teamB: 'DRX', scoreA: 2, scoreB: 0, winner: 'A', status: 'completed' });
  });

  it('解析赛事名与时间', () => {
    const ms = parseMatches(fixture);
    expect(ms[1].event).toContain('VCT Champions 2026');
    expect(ms[1].series).toBe('Grand Final');
    expect(ms[0].time).toBe('5:00 PM');
  });
});

describe('parseEventAgents（职业赛 meta）', () => {
  const fixture = `<table><tr><th style="width: 42px; height: 40px; padding: 0;">
      <img src="/img/vlr/game/agents/jett.png" title="Jett"></th>
      <th><img src="/img/vlr/game/agents/omen.png" title="Omen"></th></tr>
    <tr class="pr-global-row "><td style="white-space: nowrap;"><span class="map-pseudo-icon">S</span>
      Split</td>
      <td class="mod-right">7</td><td class="mod-right">68%</td><td class="mod-right">32%</td>
      <td class="mod-color-sq mod-center" style="--stat-h:155">86%</td>
      <td class="mod-color-sq mod-center" style="--stat-h:0">0%</td></tr></table>`;

  it('解析地图行：场次与攻防胜率', () => {
    const r = parseEventAgents(fixture);
    expect(r.maps).toHaveLength(1);
    expect(r.maps[0]).toMatchObject({ name: 'Split', matches: 7, atkWin: 68, defWin: 32 });
  });

  it('解析特工 pick 矩阵（按 th 顺序对应）', () => {
    const r = parseEventAgents(fixture);
    expect(r.maps[0].picks).toEqual([
      { agent: 'Jett', pct: 86 },
      { agent: 'Omen', pct: 0 },
    ]);
  });

  it('parseEventList 提取当前赛事', () => {
    const list = parseEventList('<a href="/event/2766/valorant-champions-2026">...</a>');
    expect(list).toEqual({ id: 2766, name: 'Valorant Champions 2026' });
  });
});