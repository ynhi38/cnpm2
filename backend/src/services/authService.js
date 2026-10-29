const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/userRepository');
const { signAdmin } = require('../middleware/auth');
const v = require('../utils/validate');
const { badRequest, unauthorized, forbidden } = require('../utils/httpError');
const audit = require('./audit');

const publicUser = (u) => ({ id: u.UserId, username: u.Username, fullName: u.FullName, email: u.Email, role: u.Role });

exports.login = async (body) => {
  const username = v.str(body.username, { name: 'Tên đăng nhập', required: true, max: 50 });
  const password = v.str(body.password, { name: 'Mật khẩu', required: true, max: 100 });
  const u = await userRepo.findForLogin(username);
  // Luôn so sánh hash để tránh lộ việc tài khoản có tồn tại hay không
  const ok = await bcrypt.compare(password, u?.PasswordHash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
  if (!u || !ok) throw unauthorized('Sai tên đăng nhập hoặc mật khẩu');
  if (!u.IsActive) throw forbidden('Tài khoản đã bị khóa');
  await userRepo.touchLogin(u.UserId);
  audit({ id: u.UserId }, 'LOGIN', 'User', u.UserId, u.Username);
  return { token: signAdmin(u), user: publicUser(u) };
};

exports.me = async (id) => {
  const u = await userRepo.findById(id);
  if (!u || !u.IsActive) throw unauthorized('Tài khoản không còn hiệu lực');
  return publicUser(u);
};

exports.checkPasswordPolicy = (pw) => {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 100 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    throw badRequest('Mật khẩu cần 8-100 ký tự, gồm cả chữ và số');
  }
};

exports.changePassword = async (userId, body) => {
  const hash = await userRepo.findHash(userId);
  if (!hash || !(await bcrypt.compare(String(body.currentPassword || ''), hash))) throw badRequest('Mật khẩu hiện tại không đúng');
  exports.checkPasswordPolicy(body.newPassword);
  await userRepo.setPassword(userId, await bcrypt.hash(body.newPassword, 10));
  audit({ id: userId }, 'UPDATE', 'User', userId, 'đổi mật khẩu');
};
