/* Kiểm tra nhanh: nạp mọi module, in cấu hình, thử kết nối SQL Server. Chạy: npm run check */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
let failed = 0;
for (const f of walk(path.join(__dirname, '../src'))) {
  try { require(f); } catch (e) { failed++; console.error('✗', path.relative(process.cwd(), f), '-', e.message); }
}
console.log(failed ? `${failed} module lỗi` : '✓ Nạp đủ module');

require('../src/config/db').query('SELECT COUNT(*) AS stories FROM dbo.Stories')
  .then((r) => { console.log('✓ SQL Server OK, số câu chuyện:', r[0].stories); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error('✗ Không kết nối được SQL Server:', e.message); process.exit(1); });
