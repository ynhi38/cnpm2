const crypto = require('crypto');

// Bỏ các ký tự dễ nhầm: 0/O, 1/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomBlock(len = 4) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Sinh mã vé dạng MS-XXXX-XXXX */
const generateCode = (prefix = 'MS') => `${prefix}-${randomBlock()}-${randomBlock()}`;

/** Sinh `count` mã không trùng nhau. */
function generateUniqueCodes(count, prefix = 'MS') {
  const set = new Set();
  while (set.size < count) set.add(generateCode(prefix));
  return [...set];
}

/** Chuẩn hóa mã người dùng nhập: viết hoa, bỏ khoảng trắng/ký tự lạ. Trả về { code, compact }. */
function normalizeCode(input) {
  const code = String(input || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return { code, compact: code.replace(/-/g, '') };
}

const isPlausibleCode = (input) => {
  const { compact } = normalizeCode(input);
  return compact.length >= 6 && compact.length <= 18;
};

module.exports = { generateCode, generateUniqueCodes, normalizeCode, isPlausibleCode, ALPHABET };
