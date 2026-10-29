const repo = require('../repositories/languageRepository');
const config = require('../config');
const v = require('../utils/validate');
const { notFound, badRequest } = require('../utils/httpError');
const audit = require('./audit');

/** Chuẩn hóa mã ngôn ngữ từ query (?lang=en); không hợp lệ => tiếng Việt. */
exports.resolve = (code) => (config.languages.includes(String(code || '').toLowerCase()) ? String(code).toLowerCase() : config.defaultLanguage);

exports.listPublic = () => repo.list({ onlyActive: true });
exports.listAdmin = () => repo.list();

exports.update = async (id, body, user) => {
  const lang = await repo.findById(id);
  if (!lang) throw notFound('Không tìm thấy ngôn ngữ');
  const isActive = v.bool(body.isActive, !!lang.IsActive);
  if (!isActive && lang.Code === config.defaultLanguage) throw badRequest('Không thể tắt ngôn ngữ gốc (tiếng Việt)');
  await repo.update(id, {
    nativeName: v.str(body.nativeName ?? lang.NativeName, { name: 'Tên bản ngữ', required: true, max: 60 }),
    ttsLocale: v.str(body.ttsLocale ?? lang.TtsLocale, { name: 'Locale TTS', required: true, max: 15 }),
    isActive,
    sortOrder: v.int(body.sortOrder ?? lang.SortOrder, { name: 'Thứ tự', min: 0, max: 99 }),
  });
  audit(user, 'UPDATE', 'Language', id, lang.Code);
  return repo.findById(id);
};
