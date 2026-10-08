import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMatches, parsePlayerStats, parseTeamRanking, validateEsportsStats } from '../scripts/lib/vlr.mjs';

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