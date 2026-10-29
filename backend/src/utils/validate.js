const { badRequest } = require('./httpError');

/** Chuỗi: cắt khoảng trắng, kiểm tra bắt buộc / độ dài. */
function str(value, { name = 'Trường', required = false, max = 255, min = 0 } = {}) {
  const v = value == null ? '' : String(value).trim();
  if (!v) {
    if (required) throw badRequest(`${name} là bắt buộc`);
    return null;
  }
  if (v.length < min) throw badRequest(`${name} phải có ít nhất ${min} ký tự`);
  if (v.length > max) throw badRequest(`${name} tối đa ${max} ký tự`);
  return v;
}

function int(value, { name = 'Trường', required = false, min = -2147483648, max = 2147483647 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${name} là bắt buộc`);
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${name} phải là số nguyên từ ${min} đến ${max}`);
  return n;
}

function num(value, { name = 'Trường', min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${name} không hợp lệ (${min} … ${max})`);
  return n;
}

const bool = (value, def = false) => (value === undefined || value === null ? def : value === true || value === 1 || value === '1' || value === 'true');

function oneOf(value, list, { name = 'Trường', required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${name} là bắt buộc`);
    return null;
  }
  if (!list.includes(value)) throw badRequest(`${name} phải thuộc: ${list.join(', ')}`);
  return value;
}

/** Chỉ cho phép đường dẫn file do hệ thống upload sinh ra (hoặc URL http/https). */
function mediaUrl(value, name = 'Đường dẫn') {
  const v = str(value, { name, max: 400 });
  if (v && !/^(\/uploads\/[\w./-]+|https?:\/\/\S+)$/.test(v)) throw badRequest(`${name} không hợp lệ`);
  return v;
}

function paging(query, { defaultSize = 20, maxSize = 100 } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number(query.pageSize) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

module.exports = { str, int, num, bool, oneOf, mediaUrl, paging };
