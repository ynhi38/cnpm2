const jwt = require('jsonwebtoken');
const { unauthorized, forbidden } = require('../utils/httpError');

const adminSecret = () => process.env.JWT_SECRET || 'change-me-admin-secret';
const visitorSecret = () => process.env.VISITOR_JWT_SECRET || 'change-me-visitor-secret';

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

const signAdmin = (user) =>
  jwt.sign({ sub: user.UserId, role: user.Role, name: user.FullName, typ: 'admin' }, adminSecret(), { expiresIn: '8h' });

const signVisitor = (ticket, expiresInSeconds) =>
  jwt.sign({ tid: ticket.TicketId, typ: 'visitor' }, visitorSecret(), { expiresIn: Math.max(60, expiresInSeconds) });

/** Bắt buộc đăng nhập quản trị. */
function requireAdmin(req, res, next) {
  const token = bearer(req);
  if (!token) return next(unauthorized());
  try {
    const p = jwt.verify(token, adminSecret());
    if (p.typ !== 'admin') return next(unauthorized());
    req.user = { id: p.sub, role: p.role, name: p.name };
    next();
  } catch {
    next(unauthorized('Phiên đăng nhập đã hết hạn'));
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden('Chỉ quản trị viên mới được thực hiện thao tác này'));

/** Gắn thông tin khách (nếu có vé hợp lệ) – không bắt buộc. */
function optionalVisitor(req, res, next) {
  const token = bearer(req);
  if (!token) return next();
  try {
    const p = jwt.verify(token, visitorSecret());
    if (p.typ === 'visitor') req.visitor = { ticketId: p.tid };
  } catch {
    /* token sai/hết hạn: coi như khách chưa có vé */
  }
  try {
    const p = jwt.verify(token, adminSecret());
    if (p.typ === 'admin') req.user = { id: p.sub, role: p.role, name: p.name };
  } catch {
    /* ignore */
  }
  next();
}

function requireVisitor(req, res, next) {
  optionalVisitor(req, res, () => (req.visitor ? next() : next(unauthorized('Vui lòng nhập mã vé để nghe thuyết minh'))));
}

module.exports = { signAdmin, signVisitor, requireAdmin, requireRole, optionalVisitor, requireVisitor };
