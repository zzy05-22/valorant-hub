import { describe, expect, it } from 'vitest';
import { filterSpots, groupSpotsByAgent, groupSpotsByMap, type LineupSpot } from '../../src/utils/lineups';

const spots: LineupSpot[] = [
  { mapId: 'ascent', agentId: 'sage', ability: 'Q', label: 'A封口墙', x: 20, y: 45, side: '防守', note: 'a' },
  { mapId: 'ascent', agentId: 'sova', ability: 'E', label: '中门箭', x: 50, y: 30, side: '进攻', note: 'b' },
  { mapId: 'split', agentId: 'sage', ability: 'Q', label: 'B封口墙', x: 78, y: 50, side: '防守', note: 'c' },
];

describe('groupSpotsByAgent', () => {
  it('按特工分组', () => {
    const g = groupSpotsByAgent(spots);
    expect(g.get('sage')).toHaveLength(2);
    expect(g.get('sova')).toHaveLength(1);
  });
});

describe('groupSpotsByMap', () => {
  it('按地图分组', () => {
    const g = groupSpotsByMap(spots);
    expect(g.get('ascent')).toHaveLength(2);
    expect(g.get('split')).toHaveLength(1);
  });
});

describe('filterSpots', () => {
  it('按地图+特工双键过滤', () => {
    expect(filterSpots(spots, 'ascent', 'sage')).toEqual([spots[0]]);
    expect(filterSpots(spots, 'ascent', 'jett')).toEqual([]);
  });
});