const { query, p } = require('../config/db');

exports.totals = async () =>
  (await query(`
    SELECT (SELECT COUNT(*) FROM dbo.Stories) AS Stories,
           (SELECT COUNT(*) FROM dbo.Stories WHERE IsPublished = 1) AS Published,
           (SELECT COUNT(*) FROM dbo.ZoneGroups) AS Zones,
           (SELECT COUNT(*) FROM dbo.ListenLogs) AS Listens,
           (SELECT COUNT(*) FROM dbo.ListenLogs WHERE ListenedAt >= CAST(SYSUTCDATETIME() AS DATE)) AS ListensToday,
           (SELECT COUNT(*) FROM dbo.Tickets WHERE ActivatedAt >= CAST(SYSUTCDATETIME() AS DATE)) AS ActivatedToday`))[0];

exports.listensByDay = (days) =>
  query(`SELECT ListenDate, Listens FROM dbo.vw_DailyListens WHERE ListenDate >= DATEADD(DAY, -@d + 1, CAST(SYSUTCDATETIME() AS DATE)) ORDER BY ListenDate`,
    { d: p.int(days) });

exports.topStories = (limit = 8) =>
  query(`SELECT TOP (@n) s.StoryId, s.Code, COALESCE(t.Title, s.Code) AS Title, COUNT(g.LogId) AS Listens
         FROM dbo.Stories s
         LEFT JOIN dbo.StoryTranslations t ON t.StoryId = s.StoryId AND t.LanguageId = (SELECT LanguageId FROM dbo.Languages WHERE Code = N'vi')
         LEFT JOIN dbo.ListenLogs g ON g.StoryId = s.StoryId
         GROUP BY s.StoryId, s.Code, t.Title ORDER BY COUNT(g.LogId) DESC, s.SortOrder`, { n: p.int(limit) });

exports.byLanguage = () =>
  query(`SELECT l.Code, l.NativeName, COUNT(g.LogId) AS Listens FROM dbo.Languages l
         LEFT JOIN dbo.ListenLogs g ON g.LanguageId = l.LanguageId GROUP BY l.Code, l.NativeName, l.SortOrder ORDER BY l.SortOrder`);

exports.bySource = () => query('SELECT Source, Mode, COUNT(*) AS Listens FROM dbo.ListenLogs GROUP BY Source, Mode');

/** Câu chuyện còn thiếu bản dịch ở ngôn ngữ đang bật. */
exports.missingTranslations = () =>
  query(`SELECT s.StoryId, s.Code, l.Code AS LangCode
         FROM dbo.Stories s CROSS JOIN dbo.Languages l
         WHERE l.IsActive = 1 AND NOT EXISTS (SELECT 1 FROM dbo.StoryTranslations t WHERE t.StoryId = s.StoryId AND t.LanguageId = l.LanguageId)
         ORDER BY s.SortOrder, l.SortOrder`);
