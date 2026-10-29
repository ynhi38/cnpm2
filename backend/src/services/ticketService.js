const repo = require('../repositories/ticketRepository');
const languageService = require('./languageService');
const v = require('../utils/validate');
const { signVisitor } = require('../middleware/auth');
const { generateUniqueCodes, normalizeCode, isPlausibleCode } = require('../utils/ticketCode');
const { toCsv } = require('../utils/csv');
const { badRequest, notFound, forbidden, gone, conflict } = require('../utils/httpError');
const audit = require('./audit');

const STATUSES = ['Unused', 'Activated', 'Expired', 'Revoked'];

/* ---------------- Khách ---------------- */

/** Nhập mã vé: kích hoạt lần đầu (bắt đầu tính hiệu lực), trả về token truy cập. */
exports.activate = async (rawCode, langCode) => {
  if (!isPlausibleCode(rawCode)) throw badRequest('Mã vé không hợp lệ');
  const lang = languageService.resolve(langCode);
  let ticket = await repo.findByCode(normalizeCode(rawCode));
  if (!ticket) throw notFound('Không tìm thấy mã vé. Vui lòng kiểm tra lại mã in trên vé.');
  if (ticket.Status === 'Revoked') throw forbidden('Vé đã bị thu hồi. Vui lòng liên hệ quầy vé.');

  if (ticket.Status === 'Unused') {
    const ok = await repo.activate(ticket.TicketId, ticket.ValidHours, lang);
    ticket = await repo.findByCode(normalizeCode(rawCode));
    if (!ok && ticket.Status === 'Revoked') throw forbidden('Vé đã bị thu hồi. Vui lòng liên hệ quầy vé.');
  }
  if (ticket.Status !== 'Activated' || ticket.SecondsLeft <= 0) throw gone('Vé đã hết hạn sử dụng.', 'TICKET_EXPIRED');

  return {
    token: signVisitor(ticket, ticket.SecondsLeft),
    expiresAt: ticket.ExpiresAt,
    secondsLeft: ticket.SecondsLeft,
    ticket: { code: ticket.Code, typeName: ticket.TypeName },
  };
};

/** Kiểm tra vé của khách còn hiệu lực (chưa hết hạn, chưa bị thu hồi). */
exports.isValid = async (ticketId) => {
  const t = await repo.findById(ticketId);
  return !!t && t.Status === 'Activated' && t.SecondsLeft > 0;
};

exports.me = async (ticketId) => {
  const t = await repo.findById(ticketId);
  if (!t || t.Status !== 'Activated' || t.SecondsLeft <= 0) throw gone('Vé đã hết hạn hoặc bị thu hồi', 'TICKET_EXPIRED');
  return { code: t.Code, typeName: t.TypeName, expiresAt: t.ExpiresAt, secondsLeft: t.SecondsLeft };
};

/* ---------------- Quản trị ---------------- */

exports.listTypes = () => repo.listTypes();

function parseType(b) {
  return {
    name: v.str(b.name, { name: 'Tên loại vé', required: true, max: 100 }),
    validHours: v.int(b.validHours, { name: 'Số giờ hiệu lực', required: true, min: 1, max: 24 * 30 }),
    price: v.int(b.price ?? 0, { name: 'Giá', min: 0, max: 100000000 }),
    isActive: v.bool(b.isActive, true),
  };
}
exports.createType = async (b, user) => {
  const t = parseType(b);
  const id = await repo.createType(t);
  audit(user, 'CREATE', 'TicketType', id, t.name);
  return repo.findType(id);
};
exports.updateType = async (id, b, user) => {
  if (!(await repo.findType(id))) throw notFound('Không tìm thấy loại vé');
  await repo.updateType(id, parseType(b));
  audit(user, 'UPDATE', 'TicketType', id);
  return repo.findType(id);
};

/** Phát hành hàng loạt vé: mã ngẫu nhiên, không trùng. */
exports.generate = async (b, user) => {
  const quantity = v.int(b.quantity, { name: 'Số lượng', required: true, min: 1, max: 1000 });
  const typeId = v.int(b.ticketTypeId, { name: 'Loại vé', required: true, min: 1 });
  const type = await repo.findType(typeId);
  if (!type || !type.IsActive) throw badRequest('Loại vé không tồn tại hoặc đang tắt');
  const prefix = (v.str(b.prefix, { name: 'Tiền tố', max: 6 }) || 'MS').toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(prefix)) throw badRequest('Tiền tố chỉ gồm 2-6 chữ cái/số');
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const batchCode = (v.str(b.batchCode, { name: 'Mã lô', max: 30 }) || `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const codes = generateUniqueCodes(quantity, prefix);
      const inserted = await repo.insertBatch(codes, { typeId, batchCode, userId: user.id });
      audit(user, 'CREATE', 'TicketBatch', batchCode, `${inserted} vé - ${type.Name}`);
      return { batchCode, quantity: inserted };
    } catch (e) {
      if (e.number !== 2627 && e.number !== 2601) throw e;   // trùng mã (hiếm) => sinh lại
    }
  }
  throw conflict('Không thể sinh mã vé không trùng, vui lòng thử lại');
};

function filters(q) {
  return {
    status: v.oneOf(q.status || null, STATUSES, { name: 'Trạng thái', required: false }),
    batch: v.str(q.batch, { max: 30 }),
    q: v.str(q.q, { max: 30 }),
  };
}

exports.list = async (q) => {
  const pg = v.paging(q);
  const { items, total } = await repo.list(filters(q), pg);
  return { items, total, page: pg.page, pageSize: pg.pageSize };
};

exports.listBatches = () => repo.listBatches();

exports.revoke = async (id, user) => {
  if (!(await repo.revoke(id))) throw notFound('Không tìm thấy vé hoặc vé đã bị thu hồi');
  audit(user, 'REVOKE', 'Ticket', id);
};

exports.exportCsv = async (q) => {
  const rows = await repo.listForExport(filters(q));
  return toCsv(rows, [
    { key: 'Code', label: 'Mã vé' }, { key: 'BatchCode', label: 'Lô' }, { key: 'Status', label: 'Trạng thái' },
    { key: 'TypeName', label: 'Loại vé' }, { key: 'IssuedAt', label: 'Ngày phát hành (UTC)' },
    { key: 'ActivatedAt', label: 'Ngày kích hoạt (UTC)' }, { key: 'ExpiresAt', label: 'Hết hạn (UTC)' },
  ]);
};

exports.countByStatus = async () => {
  const out = { Unused: 0, Activated: 0, Expired: 0, Revoked: 0 };
  for (const r of await repo.countByStatus()) out[r.Status] = r.n;
  return out;
};
