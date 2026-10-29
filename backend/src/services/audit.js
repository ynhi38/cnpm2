const auditRepository = require('../repositories/auditRepository');

/** Ghi nhật ký thao tác (không làm hỏng nghiệp vụ chính nếu ghi lỗi). */
module.exports = (user, action, entity, entityId, detail) =>
  auditRepository.log(user?.id ?? null, action, entity, entityId, detail).catch((e) => console.error('Audit error:', e.message));
