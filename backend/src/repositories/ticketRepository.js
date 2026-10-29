const { query, run, p, transaction } = require('../config/db');

/* Trạng thái hiển thị: Activated nhưng quá hạn => Expired */
const EFFECTIVE_STATUS = `CASE WHEN t.Status = N'Activated' AND t.ExpiresAt <= SYSUTCDATETIME() THEN N'Expired' ELSE t.Status END`;

/* ---------- Loại vé ---------- */
exports.listTypes = () =>
  query(`SELECT tt.TicketTypeId, tt.Name, tt.ValidHours, tt.Price, tt.IsActive,
                (SELECT COUNT(*) FROM dbo.Tickets t WHERE t.TicketTypeId = tt.TicketTypeId) AS TicketCount
         FROM dbo.TicketTypes tt ORDER BY tt.TicketTypeId`);
exports.findType = async (id) => (await query('SELECT * FROM dbo.TicketTypes WHERE TicketTypeId=@id', { id: p.int(id) }))[0];
exports.createType = async (t) =>
  (await query('INSERT INTO dbo.TicketTypes (Name, ValidHours, Price, IsActive) OUTPUT INSERTED.TicketTypeId VALUES (@n,@h,@pr,@a)',
    { n: p.str(t.name, 100), h: p.int(t.validHours), pr: p.int(t.price), a: p.bit(t.isActive) }))[0].TicketTypeId;
exports.updateType = async (id, t) =>
  (await run('UPDATE dbo.TicketTypes SET Name=@n, ValidHours=@h, Price=@pr, IsActive=@a WHERE TicketTypeId=@id',
    { id: p.int(id), n: p.str(t.name, 100), h: p.int(t.validHours), pr: p.int(t.price), a: p.bit(t.isActive) })).rowsAffected[0] > 0;

/* ---------- Vé ---------- */
exports.findByCode = async ({ code, compact }) =>
  (await query(
    `SELECT t.TicketId, t.Code, t.Status, t.ActivatedAt, t.ExpiresAt, tt.Name AS TypeName, tt.ValidHours,
            DATEDIFF(SECOND, SYSUTCDATETIME(), t.ExpiresAt) AS SecondsLeft
     FROM dbo.Tickets t JOIN dbo.TicketTypes tt ON tt.TicketTypeId = t.TicketTypeId
     WHERE t.Code = @code OR REPLACE(t.Code, N'-', N'') = @compact`,
    { code: p.str(code, 30), compact: p.str(compact, 30) }))[0];

exports.findById = async (id) =>
  (await query(
    `SELECT t.TicketId, t.Code, t.Status, t.ExpiresAt, tt.Name AS TypeName,
            DATEDIFF(SECOND, SYSUTCDATETIME(), t.ExpiresAt) AS SecondsLeft
     FROM dbo.Tickets t JOIN dbo.TicketTypes tt ON tt.TicketTypeId = t.TicketTypeId WHERE t.TicketId = @id`,
    { id: p.int(id) }))[0];

/** Kích hoạt nguyên tử: chỉ vé Unused mới được chuyển sang Activated. Trả về true nếu thành công. */
exports.activate = async (ticketId, validHours, langCode) =>
  (await run(
    `UPDATE dbo.Tickets SET Status = N'Activated', ActivatedAt = SYSUTCDATETIME(),
            ExpiresAt = DATEADD(HOUR, @hours, SYSUTCDATETIME()),
            LanguageId = (SELECT LanguageId FROM dbo.Languages WHERE Code = @lang)
     WHERE TicketId = @id AND Status = N'Unused'`,
    { id: p.int(ticketId), hours: p.int(validHours), lang: p.str(langCode, 10) })).rowsAffected[0] > 0;

exports.revoke = async (id) =>
  (await run("UPDATE dbo.Tickets SET Status = N'Revoked' WHERE TicketId = @id AND Status <> N'Revoked'", { id: p.int(id) })).rowsAffected[0] > 0;

exports.insertBatch = (codes, { typeId, batchCode, userId }) =>
  transaction(async (tx) => {
    const r = await run(
      `INSERT INTO dbo.Tickets (Code, TicketTypeId, BatchCode, Status, IssuedBy)
       SELECT j.value, @type, @batch, N'Unused', @user FROM OPENJSON(@codes) j`,
      { codes: p.str(JSON.stringify(codes)), type: p.int(typeId), batch: p.str(batchCode, 30), user: p.int(userId) }, tx);
    return r.rowsAffected[0];
  });

const filterSql = `
  WHERE (@status IS NULL OR ${EFFECTIVE_STATUS} = @status)
    AND (@batch IS NULL OR t.BatchCode = @batch)
    AND (@q IS NULL OR t.Code LIKE @q)`;
const filterParams = ({ status, batch, q }) => ({
  status: p.str(status ?? null, 15), batch: p.str(batch ?? null, 30),
  q: p.str(q ? `%${q.replace(/[%_[]/g, '[$&]')}%` : null, 40),
});
const FROM = `FROM dbo.Tickets t
  JOIN dbo.TicketTypes tt ON tt.TicketTypeId = t.TicketTypeId
  LEFT JOIN dbo.Users u ON u.UserId = t.IssuedBy
  LEFT JOIN dbo.Languages l ON l.LanguageId = t.LanguageId`;

exports.list = async (filters, { offset, pageSize }) => {
  const params = { ...filterParams(filters), offset: p.int(offset), size: p.int(pageSize) };
  const [items, total] = await Promise.all([
    query(`SELECT t.TicketId, t.Code, t.BatchCode, ${EFFECTIVE_STATUS} AS Status, t.IssuedAt, t.ActivatedAt, t.ExpiresAt,
                  tt.Name AS TypeName, u.FullName AS IssuedByName, l.Code AS LangCode
           ${FROM} ${filterSql} ORDER BY t.TicketId DESC OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`, params),
    query(`SELECT COUNT(*) AS n ${FROM} ${filterSql}`, params),
  ]);
  return { items, total: total[0].n };
};

exports.listForExport = (filters) =>
  query(`SELECT t.Code, t.BatchCode, ${EFFECTIVE_STATUS} AS Status, tt.Name AS TypeName, t.IssuedAt, t.ActivatedAt, t.ExpiresAt
         ${FROM} ${filterSql} ORDER BY t.TicketId`, filterParams(filters));

exports.listBatches = () =>
  query(`SELECT t.BatchCode, MIN(tt.Name) AS TypeName, COUNT(*) AS Total, MIN(t.IssuedAt) AS IssuedAt,
                SUM(CASE WHEN t.Status = N'Unused' THEN 1 ELSE 0 END) AS Unused,
                SUM(CASE WHEN t.Status = N'Activated' AND t.ExpiresAt > SYSUTCDATETIME() THEN 1 ELSE 0 END) AS Active,
                SUM(CASE WHEN t.Status = N'Activated' AND t.ExpiresAt <= SYSUTCDATETIME() THEN 1 ELSE 0 END) AS Expired,
                SUM(CASE WHEN t.Status = N'Revoked' THEN 1 ELSE 0 END) AS Revoked
         FROM dbo.Tickets t JOIN dbo.TicketTypes tt ON tt.TicketTypeId = t.TicketTypeId
         WHERE t.BatchCode IS NOT NULL GROUP BY t.BatchCode ORDER BY MIN(t.IssuedAt) DESC`);

exports.countByStatus = () =>
  query(`SELECT Status, COUNT(*) AS n FROM (SELECT ${EFFECTIVE_STATUS} AS Status FROM dbo.Tickets t) x GROUP BY Status`);
