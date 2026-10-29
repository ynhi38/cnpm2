const repo = require('../repositories/zoneRepository');
const languageService = require('./languageService');
const v = require('../utils/validate');
const { notFound, conflict } = require('../utils/httpError');
const audit = require('./audit');

const pick = (z, lang) => ({
  zoneId: z.ZoneId, code: z.Code, name: lang === 'en' ? z.NameEn : lang === 'zh' ? z.NameZh : z.NameVi,
  description: z.Description, sortOrder: z.SortOrder, storyCount: z.StoryCount,
});

exports.listPublic = async (langCode) => {
  const lang = languageService.resolve(langCode);
  return (await repo.list()).map((z) => pick(z, lang));
};

exports.listAdmin = () => repo.list();

function parse(body) {
  return {
    code: v.str(body.code, { name: 'Mã khu', required: true, max: 10 }),
    nameVi: v.str(body.nameVi, { name: 'Tên tiếng Việt', required: true, max: 150 }),
    nameEn: v.str(body.nameEn, { name: 'Tên tiếng Anh', required: true, max: 150 }),
    nameZh: v.str(body.nameZh, { name: 'Tên tiếng Trung', required: true, max: 150 }),
    description: v.str(body.description, { name: 'Mô tả', max: 500 }),
    sortOrder: v.int(body.sortOrder ?? 0, { name: 'Thứ tự', min: 0, max: 9999 }),
  };
}

exports.create = async (body, user) => {
  const z = parse(body);
  const id = await repo.create(z);
  audit(user, 'CREATE', 'Zone', id, z.code);
  return repo.findById(id);
};

exports.update = async (id, body, user) => {
  if (!(await repo.findById(id))) throw notFound('Không tìm thấy khu');
  const z = parse(body);
  await repo.update(id, z);
  audit(user, 'UPDATE', 'Zone', id, z.code);
  return repo.findById(id);
};

exports.remove = async (id, user) => {
  const z = await repo.findById(id);
  if (!z) throw notFound('Không tìm thấy khu');
  if ((await repo.countStories(id)) > 0) throw conflict('Khu còn câu chuyện, hãy chuyển câu chuyện sang khu khác trước khi xóa');
  await repo.remove(id);
  audit(user, 'DELETE', 'Zone', id, z.Code);
};
