const { query, p } = require('../config/db');

const COLS = 'LanguageId, Code, Name, NativeName, TtsLocale, IsActive, SortOrder';

exports.list = ({ onlyActive = false } = {}) =>
  query(`SELECT ${COLS} FROM dbo.Languages ${onlyActive ? 'WHERE IsActive = 1' : ''} ORDER BY SortOrder`);

exports.findByCode = async (code) =>
  (await query(`SELECT ${COLS} FROM dbo.Languages WHERE Code = @code`, { code: p.str(code, 10) }))[0];

exports.findById = async (id) => (await query(`SELECT ${COLS} FROM dbo.Languages WHERE LanguageId = @id`, { id: p.int(id) }))[0];

exports.update = (id, { nativeName, ttsLocale, isActive, sortOrder }) =>
  query(
    `UPDATE dbo.Languages SET NativeName = @nativeName, TtsLocale = @ttsLocale, IsActive = @isActive, SortOrder = @sortOrder
     WHERE LanguageId = @id`,
    { id: p.int(id), nativeName: p.str(nativeName, 60), ttsLocale: p.str(ttsLocale, 15), isActive: p.bit(isActive), sortOrder: p.int(sortOrder) },
  );
