// 全站搜索纯函数：构建期生成索引、客户端过滤（页面 script 与单测共用）
export interface SearchEntity {
  type: string;   // 特工/武器/地图/教学/版本资讯/电竞资讯
  title: string;  // 主标题（中文为主）
  sub: string;    // 副信息（英文名/分类/类型）
  url: string;
}

export function searchEntities(entities: SearchEntity[], query: string): SearchEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return entities.filter(
    (e) => e.title.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q),
  );
}