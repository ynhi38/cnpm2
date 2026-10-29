const test = require('node:test');
const assert = require('node:assert');
const { generateUniqueCodes, normalizeCode, isPlausibleCode } = require('../src/utils/ticketCode');
const v = require('../src/utils/validate');
const { toCsv } = require('../src/utils/csv');

test('sinh mã vé không trùng, đúng định dạng', () => {
  const codes = generateUniqueCodes(500);
  assert.strictEqual(new Set(codes).size, 500);
  for (const c of codes) assert.match(c, /^MS-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
});

test('chuẩn hóa mã vé người dùng nhập', () => {
  assert.deepStrictEqual(normalizeCode(' demo-0001 '), { code: 'DEMO-0001', compact: 'DEMO0001' });
  assert.strictEqual(normalizeCode('ms abcd 1234').compact, 'MSABCD1234');
  assert.strictEqual(isPlausibleCode('ab'), false);
  assert.strictEqual(isPlausibleCode('DEMO-0001'), true);
});

test('validate', () => {
  assert.strictEqual(v.str('  a ', { max: 5 }), 'a');
  assert.throws(() => v.str('', { required: true }), /bắt buộc/);
  assert.throws(() => v.int('x'), /số nguyên/);
  assert.strictEqual(v.int('7', { min: 1 }), 7);
  assert.throws(() => v.mediaUrl('javascript:alert(1)'), /không hợp lệ/);
  assert.strictEqual(v.mediaUrl('/uploads/audio/a.mp3'), '/uploads/audio/a.mp3');
  assert.deepStrictEqual(v.paging({ page: '3', pageSize: '10' }), { page: 3, pageSize: 10, offset: 20 });
});

test('csv thoát ký tự đặc biệt', () => {
  const out = toCsv([{ a: 'x,"y"', b: 1 }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
  assert.ok(out.includes('"x,""y"""'));
});
