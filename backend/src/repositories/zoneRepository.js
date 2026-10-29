const { query, p } = require('../config/db');

const COLS = 'ZoneId, Code, NameVi, NameEn, NameZh, Description, SortOrder';

exports.list = () =>
  query(`SELECT z.${COLS.split(', ').join(', z.')},
                (SELECT COUNT(*) FROM dbo.Stories s WHERE s.ZoneId = z.ZoneId) AS StoryCount
           FROM dbo.ZoneGroups z ORDER BY z.SortOrder, z.ZoneId`);

exports.findById = async (id) => (await query(`SELECT ${COLS} FROM dbo.ZoneGroups WHERE ZoneId = @id`, { id: p.int(id) }))[0];

const params = (z) => ({
  code: p.str(z.code, 10), nameVi: p.str(z.nameVi, 150), nameEn: p.str(z.nameEn, 150), nameZh: p.str(z.nameZh, 150),
  description: p.str(z.description, 500), sortOrder: p.int(z.sortOrder),
});

exports.create = async (z) =>
  (await query(
    `INSERT INTO dbo.ZoneGroups (Code, NameVi, NameEn, NameZh, Description, SortOrder)
     OUTPUT INSERTED.ZoneId
     VALUES (@code, @nameVi, @nameEn, @nameZh, @description, @sortOrder)`,
    params(z),
  ))[0].ZoneId;

exports.update = (id, z) =>
  query(
    `UPDATE dbo.ZoneGroups SET Code=@code, NameVi=@nameVi, NameEn=@nameEn, NameZh=@nameZh, Description=@description, SortOrder=@sortOrder
     WHERE ZoneId=@id`,
    { id: p.int(id), ...params(z) },
  );

exports.remove = (id) => query('DELETE FROM dbo.ZoneGroups WHERE ZoneId = @id', { id: p.int(id) });

exports.countStories = async (id) =>
  (await query('SELECT COUNT(*) AS n FROM dbo.Stories WHERE ZoneId = @id', { id: p.int(id) }))[0].n;
