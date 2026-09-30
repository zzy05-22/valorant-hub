import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePlayerStats, parseTeamRanking, validateEsportsStats } from '../scripts/lib/vlr.mjs';

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