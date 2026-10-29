/** Chuyển mảng object sang CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt). */
function toCsv(rows, columns) {
  const esc = (v) => {
    if (v == null) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(','));
  return '﻿' + [head, ...body].join('\r\n');
}

module.exports = { toCsv };
