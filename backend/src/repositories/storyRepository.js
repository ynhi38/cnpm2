const { query, run, p, transaction } = require('../config/db');

/* Tên khu theo ngôn ngữ + nội dung theo ngôn ngữ, tự động lùi về tiếng Việt nếu thiếu bản dịch */
const LOCALIZED = `
  FROM dbo.Stories s
  JOIN dbo.ZoneGroups z ON z.ZoneId = s.ZoneId
  LEFT JOIN dbo.StoryTranslations t ON t.StoryId = s.StoryId AND t.LanguageId = (SELECT LanguageId FROM dbo.Languages WHERE Code = @lang)
  LEFT JOIN dbo.StoryTranslations f ON f.StoryId = s.StoryId AND f.LanguageId = (SELECT LanguageId FROM dbo.Languages WHERE Code = N'vi')`;

const PUBLIC_COLS = `
  s.StoryId, s.Code, s.SortOrder, s.ImageUrl, s.Latitude, s.Longitude, s.MapX, s.MapY, s.TriggerRadiusM, s.IsPreview,
  z.ZoneId, z.Code AS ZoneCode,
  CASE @lang WHEN N'en' THEN z.NameEn WHEN N'zh' THEN z.NameZh ELSE z.NameVi END AS ZoneName,
  COALESCE(t.Title, f.Title) AS Title,
  COALESCE(t.Summary, f.Summary) AS Summary,
  CASE WHEN t.TranslationId IS NULL THEN N'vi' ELSE @lang END AS ContentLang,
  CASE WHEN COALESCE(CASE WHEN t.TranslationId IS NULL THEN f.AudioUrl ELSE t.AudioUrl END, N'') <> N'' THEN 1 ELSE 0 END AS HasAudio`;

exports.listPublic = ({ lang, zoneId, q }) =>
  query(
    `SELECT ${PUBLIC_COLS} ${LOCALIZED}
     WHERE s.IsPublished = 1
       AND (@zone IS NULL OR s.ZoneId = @zone)
       AND (@q IS NULL OR COALESCE(t.Title, f.Title) LIKE @q OR COALESCE(t.Summary, f.Summary) LIKE @q OR s.Code LIKE @q)
     ORDER BY s.SortOrder`,
    { lang: p.str(lang, 10), zone: p.int(zoneId ?? null), q: p.str(q ? `%${q.replace(/[%_[]/g, '[$&]')}%` : null, 120) },
  );

/** Chi tiết (kèm nội dung). `ref` là StoryId (số) hoặc mã (MS01). */
exports.findPublicDetail = async (ref, lang) => {
  const byId = /^\d+$/.test(String(ref));
  const rows = await query(
    `SELECT ${PUBLIC_COLS}, COALESCE(t.Content, f.Content) AS Content, COALESCE(CASE WHEN t.TranslationId IS NULL THEN f.AudioUrl ELSE t.AudioUrl END, N'') AS AudioUrl, s.IsPublished
     ${LOCALIZED}
     WHERE ${byId ? 's.StoryId = @id' : 's.Code = @code'}`,
    { lang: p.str(lang, 10), id: p.int(byId ? Number(ref) : null), code: p.str(byId ? null : String(ref), 20) },
  );
  return rows[0];
};

exports.availableLanguages = (storyId) =>
  query(
    `SELECT l.Code FROM dbo.StoryTranslations t JOIN dbo.Languages l ON l.LanguageId = t.LanguageId
     WHERE t.StoryId = @id AND l.IsActive = 1 ORDER BY l.SortOrder`,
    { id: p.int(storyId) },
  );

/* ---------------- Quản trị ---------------- */

exports.listAdmin = async ({ q, zoneId, offset, pageSize }) => {
  const where = `WHERE (@zone IS NULL OR o.ZoneCode = (SELECT Code FROM dbo.ZoneGroups WHERE ZoneId = @zone))
                   AND (@q IS NULL OR o.Code LIKE @q OR vi.Title LIKE @q)`;
  const params = {
    q: p.str(q ? `%${q.replace(/[%_[]/g, '[$&]')}%` : null, 120), zone: p.int(zoneId ?? null),
    offset: p.int(offset), size: p.int(pageSize),
  };
  const from = `FROM dbo.vw_StoryOverview o
     LEFT JOIN dbo.StoryTranslations vi ON vi.StoryId = o.StoryId AND vi.LanguageId = (SELECT LanguageId FROM dbo.Languages WHERE Code = N'vi')`;
  const [items, total] = await Promise.all([
    query(`SELECT o.*, vi.Title AS TitleVi ${from} ${where} ORDER BY o.SortOrder OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`, params),
    query(`SELECT COUNT(*) AS n ${from} ${where}`, params),
  ]);
  return { items, total: total[0].n };
};

exports.findAdmin = async (id) => {
  const story = (await query(
    `SELECT s.StoryId, s.Code, s.ZoneId, s.SortOrder, s.ImageUrl, s.Latitude, s.Longitude, s.MapX, s.MapY,
            s.TriggerRadiusM, s.IsPublished, s.IsPreview, s.CreatedAt, s.UpdatedAt
     FROM dbo.Stories s WHERE s.StoryId = @id`, { id: p.int(id) }))[0];
  if (!story) return null;
  story.translations = await query(
    `SELECT l.Code AS LangCode, t.Title, t.Summary, t.Content, t.AudioUrl
     FROM dbo.StoryTranslations t JOIN dbo.Languages l ON l.LanguageId = t.LanguageId WHERE t.StoryId = @id`,
    { id: p.int(id) },
  );
  return story;
};

const storyParams = (s) => ({
  code: p.str(s.code, 20), zoneId: p.int(s.zoneId), sortOrder: p.int(s.sortOrder), imageUrl: p.str(s.imageUrl, 400),
  lat: p.dec(s.latitude), lng: p.dec(s.longitude), mapX: p.dec2(s.mapX), mapY: p.dec2(s.mapY),
  radius: p.int(s.triggerRadiusM), pub: p.bit(s.isPublished), preview: p.bit(s.isPreview),
});

async function saveTranslations(tx, storyId, translations) {
  for (const [langCode, t] of Object.entries(translations)) {
    const lang = (await query('SELECT LanguageId FROM dbo.Languages WHERE Code = @c', { c: p.str(langCode, 10) }, tx))[0];
    if (!lang) continue;
    const params = { sid: p.int(storyId), lid: p.int(lang.LanguageId) };
    if (!t) {
      await query('DELETE FROM dbo.StoryTranslations WHERE StoryId=@sid AND LanguageId=@lid', params, tx);
      continue;
    }
    await query(
      `MERGE dbo.StoryTranslations AS d
       USING (SELECT @sid AS StoryId, @lid AS LanguageId) AS s ON d.StoryId = s.StoryId AND d.LanguageId = s.LanguageId
       WHEN MATCHED THEN UPDATE SET Title=@title, Summary=@summary, Content=@content, AudioUrl=@audio
       WHEN NOT MATCHED THEN INSERT (StoryId, LanguageId, Title, Summary, Content, AudioUrl) VALUES (@sid, @lid, @title, @summary, @content, @audio);`,
      { ...params, title: p.str(t.title, 200), summary: p.str(t.summary, 500), content: p.str(t.content), audio: p.str(t.audioUrl, 400) },
      tx,
    );
  }
}

exports.create = (story, translations) =>
  transaction(async (tx) => {
    const id = (await query(
      `INSERT INTO dbo.Stories (Code, ZoneId, SortOrder, ImageUrl, Latitude, Longitude, MapX, MapY, TriggerRadiusM, IsPublished, IsPreview)
       OUTPUT INSERTED.StoryId
       VALUES (@code, @zoneId, @sortOrder, @imageUrl, @lat, @lng, @mapX, @mapY, @radius, @pub, @preview)`,
      storyParams(story), tx))[0].StoryId;
    await saveTranslations(tx, id, translations);
    return id;
  });

exports.update = (id, story, translations) =>
  transaction(async (tx) => {
    const r = await run(
      `UPDATE dbo.Stories SET Code=@code, ZoneId=@zoneId, SortOrder=@sortOrder, ImageUrl=@imageUrl, Latitude=@lat, Longitude=@lng,
              MapX=@mapX, MapY=@mapY, TriggerRadiusM=@radius, IsPublished=@pub, IsPreview=@preview, UpdatedAt=SYSUTCDATETIME()
       WHERE StoryId=@id`,
      { id: p.int(id), ...storyParams(story) }, tx);
    if (!r.rowsAffected[0]) return false;
    await saveTranslations(tx, id, translations);
    return true;
  });

exports.setPublished = async (id, isPublished) =>
  (await run('UPDATE dbo.Stories SET IsPublished=@v, UpdatedAt=SYSUTCDATETIME() WHERE StoryId=@id', { id: p.int(id), v: p.bit(isPublished) })).rowsAffected[0] > 0;

exports.remove = async (id) => (await run('DELETE FROM dbo.Stories WHERE StoryId=@id', { id: p.int(id) })).rowsAffected[0] > 0;

exports.logListen = ({ storyId, langCode, ticketId, source, mode }) =>
  query(
    `INSERT INTO dbo.ListenLogs (StoryId, LanguageId, TicketId, Source, Mode)
     SELECT @sid, LanguageId, @tid, @source, @mode FROM dbo.Languages WHERE Code = @lang`,
    { sid: p.int(storyId), tid: p.int(ticketId ?? null), source: p.str(source, 10), mode: p.str(mode, 10), lang: p.str(langCode, 10) },
  );
