const { query, p } = require('../config/db');

exports.log = (userId, action, entity, entityId, detail) =>
  query('INSERT INTO dbo.AuditLogs (UserId, Action, Entity, EntityId, Detail) VALUES (@u,@a,@e,@i,@d)', {
    u: p.int(userId ?? null), a: p.str(action, 30), e: p.str(entity, 40),
    i: p.str(entityId == null ? null : String(entityId), 40), d: p.str(detail ? String(detail).slice(0, 500) : null, 500),
  });

exports.list = async ({ offset, pageSize }) => {
  const params = { offset: p.int(offset), size: p.int(pageSize) };
  const [items, total] = await Promise.all([
    query(`SELECT a.AuditId, a.Action, a.Entity, a.EntityId, a.Detail, a.CreatedAt, u.Username
           FROM dbo.AuditLogs a LEFT JOIN dbo.Users u ON u.UserId = a.UserId
           ORDER BY a.AuditId DESC OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`, params),
    query('SELECT COUNT(*) AS n FROM dbo.AuditLogs'),
  ]);
  return { items, total: total[0].n };
};
