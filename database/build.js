/* Sinh file database/MySonAudioGuide.sql (schema + dữ liệu thật) từ database/src/*.
   Chạy:  cd backend && npm install && cd .. && node database/build.js */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
// Băm mật khẩu bằng bcrypt: ưu tiên bcryptjs (sau khi npm install), nếu chưa có thì dùng PHP password_hash.
function hashPassword(pw) {
  try {
    return require(path.join(__dirname, '../backend/node_modules/bcryptjs')).hashSync(pw, 10);
  } catch {
    const h = execFileSync('php', ['-r', 'echo password_hash($argv[1], PASSWORD_BCRYPT, ["cost"=>10]);', pw]).toString();
    return h.replace(/^\$2y\$/, '$2a$');   // $2y$ và $2a$ cho kết quả giống nhau; bcryptjs đọc tốt $2a$
  }
}
const { zones, legacy, stories } = require('./src/content');
const old = require('./src/legacy-14.json');

const q = (s) => (s == null ? 'NULL' : `N'${String(s).replace(/'/g, "''")}'`);
const summary = (content) => {
  const first = content.split(/(?<=[.!?。！？])\s*/)[0] || content;
  return first.length > 220 ? first.slice(0, 217) + '...' : first;
};

// Gộp 40 câu chuyện: [code, zone, preview, {vi:[title,content], en:[...], zh:[...]}]
const all = [];
for (const code of Object.keys(legacy)) {
  const l = legacy[code];
  all.push({ code, zone: l.zone, preview: !!l.preview,
    vi: [old[code].vi.title.trim(), old[code].vi.content.trim()],
    en: [old[code].en.title.trim(), old[code].en.content.trim()],
    zh: l.zh });
}
for (const s of stories) all.push({ ...s, preview: false });
if (all.length !== 40) throw new Error('Cần đủ 40 câu chuyện, hiện có ' + all.length);
all.sort((a, b) => a.code.localeCompare(b.code));

// Vị trí: lấy tâm khu + lệch nhỏ theo thứ tự trong khu
const zoneMap = Object.fromEntries(zones.map((z) => [z.code, z]));
const seen = {};
for (const s of all) {
  const k = (seen[s.zone] = (seen[s.zone] ?? -1) + 1);
  const z = zoneMap[s.zone];
  const ang = k * 2.4, r = Math.sqrt(k + 1);
  s.lat = +(z.lat + Math.sin(ang) * r * 0.00004).toFixed(6);
  s.lng = +(z.lng + Math.cos(ang) * r * 0.00004).toFixed(6);
  s.x = +Math.min(97, Math.max(3, z.x + Math.cos(ang) * r * 2.2)).toFixed(2);
  s.y = +Math.min(97, Math.max(3, z.y + Math.sin(ang) * r * 2.2)).toFixed(2);
}

const header = `/* =====================================================================
   ĐỒ ÁN: THUYẾT MINH TỰ ĐỘNG ĐA NGÔN NGỮ (VIỆT - ANH - TRUNG) - THÁNH ĐỊA MỸ SƠN
   CSDL: Microsoft SQL Server 2017+ (cần STRING_AGG)
   FILE NÀY ĐƯỢC SINH TỰ ĐỘNG bởi database/build.js - sửa trong database/src/ rồi chạy lại.

   Cách chạy: mở trong SSMS / Azure Data Studio và bấm Execute,
              hoặc: sqlcmd -S localhost -U sa -P <mat_khau> -C -i MySonAudioGuide.sql
   Script chạy lại được nhiều lần (xóa bảng cũ rồi tạo lại - MẤT dữ liệu cũ).

   Tài khoản quản trị mặc định:  admin / Admin@123   |   staff / Staff@123   (ĐỔI MẬT KHẨU KHI TRIỂN KHAI)
   Mã vé dùng thử:               DEMO-0001 ... DEMO-0010
   ===================================================================== */

SET NOCOUNT ON;
GO

IF DB_ID(N'MySonAudioGuide') IS NULL
    CREATE DATABASE MySonAudioGuide COLLATE Vietnamese_100_CI_AI;   -- tìm kiếm không phân biệt dấu
GO

USE MySonAudioGuide;
GO

`;

let seed = `/* ---------- 5. DỮ LIỆU ---------- */
INSERT INTO dbo.Users (Username, PasswordHash, FullName, Email, Role) VALUES
 (N'admin', ${q(hashPassword('Admin@123'))}, N'Quản trị viên', N'admin@myson.local', N'Admin'),
 (N'staff', ${q(hashPassword('Staff@123'))}, N'Nhân viên bán vé', N'staff@myson.local', N'Staff');

INSERT INTO dbo.Languages (Code, Name, NativeName, TtsLocale, SortOrder) VALUES
 (N'vi', N'Vietnamese', N'Tiếng Việt', N'vi-VN', 1),
 (N'en', N'English',    N'English',    N'en-US', 2),
 (N'zh', N'Chinese',    N'中文',        N'zh-CN', 3);

INSERT INTO dbo.ZoneGroups (Code, NameVi, NameEn, NameZh, Description, SortOrder) VALUES
${zones.map((z, i) => ` (${q(z.code)}, ${q(z.vi)}, ${q(z.en)}, ${q(z.zh)}, ${q(z.desc)}, ${i + 1})`).join(',\n')};

INSERT INTO dbo.TicketTypes (Name, ValidHours, Price) VALUES
 (N'Thuyết minh tự động - 1 ngày', 24, 50000),   -- giá minh họa, chỉnh lại trong trang Admin cho đúng thực tế
 (N'Thuyết minh tự động - 3 ngày', 72, 90000);

INSERT INTO dbo.AppSettings (SettingKey, SettingValue) VALUES
 (N'site.name',    N'Thuyết minh tự động Mỹ Sơn'),
 (N'site.address', N'Duy Phú, Duy Xuyên, Quảng Nam (nay thuộc thành phố Đà Nẵng)'),
 (N'site.hours',   N'Hằng ngày - kiểm tra giờ mở cửa thực tế tại quầy vé'),
 (N'site.ticketHint', N'Mua vé tại quầy bán vé, nhập mã vé để truy cập toàn bộ câu chuyện.');

-- Tọa độ & vị trí sơ đồ chỉ mang tính tham khảo; hiệu chỉnh trong trang Admin sau khi khảo sát thực địa.
INSERT INTO dbo.Stories (Code, ZoneId, SortOrder, Latitude, Longitude, MapX, MapY, TriggerRadiusM, IsPublished, IsPreview)
SELECT v.Code, z.ZoneId, v.SortOrder, v.Lat, v.Lng, v.MapX, v.MapY, 30, 1, v.IsPreview
FROM (VALUES
${all.map((s, i) => ` (${q(s.code)}, ${q(s.zone)}, ${i + 1}, ${s.lat}, ${s.lng}, ${s.x}, ${s.y}, ${s.preview ? 1 : 0})`).join(',\n')}
) v(Code, ZoneCode, SortOrder, Lat, Lng, MapX, MapY, IsPreview)
JOIN dbo.ZoneGroups z ON z.Code = v.ZoneCode;

-- COLLATE DATABASE_DEFAULT: tránh lỗi xung đột collation giữa tempdb và CSDL (Vietnamese_100_CI_AI)
CREATE TABLE #T (StoryCode NVARCHAR(20) COLLATE DATABASE_DEFAULT, LangCode NVARCHAR(10) COLLATE DATABASE_DEFAULT,
                 Title NVARCHAR(200), Summary NVARCHAR(500), Content NVARCHAR(MAX));
`;
for (const lang of ['vi', 'en', 'zh']) {
  seed += `\n/* ----- ${{ vi: 'Tiếng Việt', en: 'English', zh: '中文' }[lang]} ----- */\nINSERT INTO #T VALUES\n`;
  seed += all.map((s) => `(${q(s.code)}, ${q(lang)}, ${q(s[lang][0])}, ${q(summary(s[lang][1]))},\n ${q(s[lang][1])})`).join(',\n') + ';\n';
}
seed += `
INSERT INTO dbo.StoryTranslations (StoryId, LanguageId, Title, Summary, Content)
SELECT s.StoryId, l.LanguageId, t.Title, t.Summary, t.Content
FROM #T t
JOIN dbo.Stories s ON s.Code = t.StoryCode
JOIN dbo.Languages l ON l.Code = t.LangCode;

DROP TABLE #T;

-- 10 vé dùng thử (chưa kích hoạt)
INSERT INTO dbo.Tickets (Code, TicketTypeId, BatchCode, Status, IssuedBy)
SELECT N'DEMO-' + RIGHT(N'0000' + CAST(n AS NVARCHAR(4)), 4), 1, N'DEMO', N'Unused', 1
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10)) x(n);
GO

PRINT N'Hoàn tất: đã tạo CSDL MySonAudioGuide (3 ngôn ngữ, 40 câu chuyện).';
GO
`;

const out = header + fs.readFileSync(path.join(__dirname, 'src/schema.sql'), 'utf8') + '\n' + seed;
fs.writeFileSync(path.join(__dirname, 'MySonAudioGuide.sql'), '﻿' + out);   // BOM để SSMS đọc đúng UTF-8
console.log('Đã sinh database/MySonAudioGuide.sql:', all.length, 'câu chuyện ×', 3, 'ngôn ngữ');
