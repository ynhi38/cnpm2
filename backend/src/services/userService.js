const bcrypt = require('bcryptjs');
const repo = require('../repositories/userRepository');
const { checkPasswordPolicy } = require('./authService');
const v = require('../utils/validate');
const { badRequest, notFound } = require('../utils/httpError');
const audit = require('./audit');

const ROLES = ['Admin', 'Staff'];
const row = (u) => ({ id: u.UserId, username: u.Username, fullName: u.FullName, email: u.Email, role: u.Role, isActive: !!u.IsActive, createdAt: u.CreatedAt, lastLoginAt: u.LastLoginAt });

exports.list = async () => (await repo.list()).map(row);

exports.create = async (body, actor) => {
  const username = v.str(body.username, { name: 'Tên đăng nhập', required: true, min: 3, max: 50 });
  if (!/^[A-Za-z0-9_.-]+$/.test(username)) throw badRequest('Tên đăng nhập chỉ gồm chữ, số, . _ -');
  checkPasswordPolicy(body.password);
  const id = await repo.create({
    username, passwordHash: await bcrypt.hash(body.password, 10),
    fullName: v.str(body.fullName, { name: 'Họ tên', required: true, max: 100 }),
    email: v.str(body.email, { name: 'Email', max: 150 }),
    role: v.oneOf(body.role || 'Staff', ROLES, { name: 'Vai trò' }),
  });
  audit(actor, 'CREATE', 'User', id, username);
  return row(await repo.findById(id));
};

exports.update = async (id, body, actor) => {
  const u = await repo.findById(id);
  if (!u) throw notFound('Không tìm thấy người dùng');
  const role = v.oneOf(body.role ?? u.Role, ROLES, { name: 'Vai trò' });
  const isActive = v.bool(body.isActive, !!u.IsActive);
  const losingAdmin = u.Role === 'Admin' && u.IsActive && (role !== 'Admin' || !isActive);
  if (losingAdmin && Number(id) === actor.id) throw badRequest('Bạn không thể tự hạ quyền hoặc khóa chính mình');
  if (losingAdmin && (await repo.countActiveAdmins()) <= 1) throw badRequest('Phải còn ít nhất một quản trị viên đang hoạt động');
  await repo.update(id, {
    fullName: v.str(body.fullName ?? u.FullName, { name: 'Họ tên', required: true, max: 100 }),
    email: v.str(body.email ?? u.Email, { name: 'Email', max: 150 }), role, isActive,
  });
  audit(actor, 'UPDATE', 'User', id, u.Username);
  return row(await repo.findById(id));
};

exports.resetPassword = async (id, body, actor) => {
  const u = await repo.findById(id);
  if (!u) throw notFound('Không tìm thấy người dùng');
  checkPasswordPolicy(body.newPassword);
  await repo.setPassword(id, await bcrypt.hash(body.newPassword, 10));
  audit(actor, 'UPDATE', 'User', id, 'đặt lại mật khẩu');
};
