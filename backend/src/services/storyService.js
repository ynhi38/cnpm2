const repo = require('../repositories/storyRepository');
const languageService = require('./languageService');
const ticketService = require('./ticketService');
const config = require('../config');
const v = require('../utils/validate');
const { badRequest, notFound } = require('../utils/httpError');
const audit = require('./audit');

const toPublic = (r) => ({
  id: r.StoryId, code: r.Code, order: r.SortOrder, imageUrl: r.ImageUrl,
  latitude: r.Latitude, longitude: r.Longitude, mapX: r.MapX, mapY: r.MapY, triggerRadiusM: r.TriggerRadiusM,
  isPreview: !!r.IsPreview, zone: { id: r.ZoneId, code: r.ZoneCode, name: r.ZoneName },
  title: r.Title, summary: r.Summary, contentLang: r.ContentLang, hasAudio: !!r.HasAudio,
});

/* ---------------- Khách ---------------- */

exports.listPublic = async (q) => {
  const lang = languageService.resolve(q.lang);
  const rows = await repo.listPublic({
    lang, zoneId: v.int(q.zone, { name: 'Khu' }), q: v.str(q.q, { max: 100 }),
  });
  return rows.map(toPublic);
};

/** Chi tiết: nội dung đầy đủ chỉ trả về khi là bản nghe thử, khách có vé hợp lệ hoặc quản trị viên xem trước. */
exports.getDetail = async (ref, q, { visitor, user }) => {
  const lang = languageService.resolve(q.lang);
  const r = await repo.findPublicDetail(ref, lang);
  if (!r || (!r.IsPublished && !user)) throw notFound('Không tìm thấy câu chuyện');
  const unlocked = !!r.IsPreview || !!user || (visitor ? await ticketService.isValid(visitor.ticketId) : false);
  const out = { ...toPublic(r), locked: !unlocked };
  out.languages = (await repo.availableLanguages(r.StoryId)).map((x) => x.Code);
  if (unlocked) {
    out.content = r.Content;
    out.audioUrl = r.AudioUrl || null;
  }
  return out;
};

exports.logListen = async (id, body, { visitor }) => {
  const ok = ['web', 'mobile'];
  await repo.logListen({
    storyId: v.int(id, { name: 'Câu chuyện', required: true }),
    langCode: languageService.resolve(body.lang),
    ticketId: visitor?.ticketId ?? null,
    source: ok.includes(body.source) ? body.source : 'web',
    mode: body.mode === 'auto' ? 'auto' : 'manual',
  });
};

/* ---------------- Quản trị ---------------- */

exports.listAdmin = async (q) => {
  const pg = v.paging(q, { defaultSize: 50, maxSize: 200 });
  const { items, total } = await repo.listAdmin({
    q: v.str(q.q, { max: 100 }), zoneId: v.int(q.zone, { name: 'Khu' }), offset: pg.offset, pageSize: pg.pageSize,
  });
  return { items, total, page: pg.page, pageSize: pg.pageSize };
};

exports.getAdmin = async (id) => {
  const s = await repo.findAdmin(id);
  if (!s) throw notFound('Không tìm thấy câu chuyện');
  return s;
};

function parse(body) {
  const story = {
    code: v.str(body.code, { name: 'Mã câu chuyện', required: true, max: 20 }),
    zoneId: v.int(body.zoneId, { name: 'Khu', required: true, min: 1 }),
    sortOrder: v.int(body.sortOrder ?? 0, { name: 'Thứ tự', min: 0, max: 9999 }),
    imageUrl: v.mediaUrl(body.imageUrl, 'Ảnh'),
    latitude: v.num(body.latitude, { name: 'Vĩ độ', min: -90, max: 90 }),
    longitude: v.num(body.longitude, { name: 'Kinh độ', min: -180, max: 180 }),
    mapX: v.num(body.mapX, { name: 'Vị trí X', min: 0, max: 100 }),
    mapY: v.num(body.mapY, { name: 'Vị trí Y', min: 0, max: 100 }),
    triggerRadiusM: v.int(body.triggerRadiusM ?? 30, { name: 'Bán kính tự phát', min: 5, max: 500 }),
    isPublished: v.bool(body.isPublished, true),
    isPreview: v.bool(body.isPreview, false),
  };
  if (!/^[A-Za-z0-9_-]+$/.test(story.code)) throw badRequest('Mã câu chuyện chỉ gồm chữ, số, gạch ngang/dưới');
  if ((story.latitude == null) !== (story.longitude == null)) throw badRequest('Cần nhập cả vĩ độ và kinh độ');
  if ((story.mapX == null) !== (story.mapY == null)) throw badRequest('Cần nhập cả vị trí X và Y trên sơ đồ');

  const translations = {};
  const input = body.translations || {};
  for (const code of config.languages) {
    const t = input[code] || {};
    const title = v.str(t.title, { name: `Tiêu đề (${code})`, max: 200 });
    const content = v.str(t.content, { name: `Nội dung (${code})`, max: 20000 });
    if (!title && !content && !t.summary && !t.audioUrl) { translations[code] = null; continue; }
    if (!title || !content) throw badRequest(`Bản ${code.toUpperCase()}: cần nhập đủ tiêu đề và nội dung (hoặc để trống hoàn toàn để xóa bản dịch)`);
    translations[code] = {
      title, content,
      summary: v.str(t.summary, { name: `Tóm tắt (${code})`, max: 500 }),
      audioUrl: v.mediaUrl(t.audioUrl, `File âm thanh (${code})`),
    };
  }
  if (story.isPublished && !translations[config.defaultLanguage]) throw badRequest('Câu chuyện xuất bản phải có bản tiếng Việt (ngôn ngữ gốc)');
  if (!Object.values(translations).some(Boolean)) throw badRequest('Cần ít nhất một bản dịch');
  return { story, translations };
}

exports.create = async (body, user) => {
  const { story, translations } = parse(body);
  const id = await repo.create(story, translations);
  audit(user, 'CREATE', 'Story', id, story.code);
  return repo.findAdmin(id);
};

exports.update = async (id, body, user) => {
  const { story, translations } = parse(body);
  if (!(await repo.update(id, story, translations))) throw notFound('Không tìm thấy câu chuyện');
  audit(user, 'UPDATE', 'Story', id, story.code);
  return repo.findAdmin(id);
};

exports.setPublished = async (id, isPublished, user) => {
  if (!(await repo.setPublished(id, v.bool(isPublished)))) throw notFound('Không tìm thấy câu chuyện');
  audit(user, 'UPDATE', 'Story', id, isPublished ? 'publish' : 'unpublish');
};

exports.remove = async (id, user) => {
  if (!(await repo.remove(id))) throw notFound('Không tìm thấy câu chuyện');
  audit(user, 'DELETE', 'Story', id);
};
