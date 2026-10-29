# Thuyết minh tự động đa ngôn ngữ – Thánh địa Mỹ Sơn

Đồ án gồm **website + trang admin (React)**, **app mobile (React Native/Expo)**, **backend 3 lớp (Node.js/Express)** và **CSDL SQL Server**, có **CI/CD** (GitHub Actions + Docker).
Hỗ trợ **3 ngôn ngữ: Tiếng Việt – English – 中文**, **40 câu chuyện** đúng như poster.

## Chức năng theo poster
| Poster | Cách thực hiện |
|---|---|
| 40 câu chuyện | CSDL có sẵn 40 câu chuyện × 3 ngôn ngữ = 120 bản nội dung (`database/MySonAudioGuide.sql`) |
| Đa ngôn ngữ thuyết minh | Chuyển VI/EN/中文 ngay trên trang; thiếu bản dịch thì tự lùi về tiếng Việt |
| Đa giác quan | Nghe (file audio hoặc giọng đọc TTS), đọc chữ, xem sơ đồ/bản đồ, ảnh minh họa |
| Dễ sử dụng | Mobile có 4 tab đúng poster: **Mã QR · Nhập mã · Câu chuyện · Sơ đồ** |
| Bước 1: quét QR tải app | QR dẫn tới web/app (in poster tại điểm bán vé) |
| Bước 2: mua vé tại quầy | Admin → *Vé & mã truy cập* → phát hành hàng loạt mã vé, xuất CSV để in |
| Bước 3: nhập mã vé để nghe | Nhập/quét mã → kích hoạt, tính hiệu lực từ lần dùng đầu; câu 1–3 nghe thử miễn phí |
| “Tự động” | Bật *Tự động phát theo vị trí*: vào bán kính GPS của điểm → tự mở và đọc câu chuyện; quét QR tại điểm cũng mở đúng câu chuyện (mã `MS01`…) |

## Cấu trúc
```
database/   MySonAudioGuide.sql (chạy trực tiếp trong SSMS)  ·  src/ + build.js (nguồn để sinh lại file SQL)
backend/    Express, 3 lớp: routes → controllers → services → repositories → SQL Server
web/        React + Vite: trang khách (/) và quản trị (/admin)
mobile/     Expo (React Native)
.github/    ci.yml (test/build), cd.yml (đẩy image GHCR + deploy SSH)
```

## Chạy nhanh bằng Docker
```bash
cp .env.example .env        # đổi DB_PASSWORD, JWT_SECRET, VISITOR_JWT_SECRET
docker compose up -d --build
```
Web `http://localhost:8080` · Admin `http://localhost:8080/admin` · API `http://localhost:4000/api/health`

## Chạy thủ công
1. **SQL Server 2017+**: mở `database/MySonAudioGuide.sql` trong SSMS/Azure Data Studio → Execute (tạo CSDL `MySonAudioGuide`).
   Hoặc: `sqlcmd -S localhost -U sa -P <mk> -C -f 65001 -i database/MySonAudioGuide.sql`
   (script **xóa và tạo lại** bảng – chỉ chạy lần đầu hoặc khi muốn reset).
2. **Backend**: `cd backend && cp .env.example .env` (sửa DB_PASSWORD…) → `npm install` → `npm run check` → `npm run dev` (cổng 4000).
3. **Web**: `cd web && npm install && npm run dev` → http://localhost:5173 (tự proxy `/api`, `/uploads` sang backend).
4. **Mobile**: `cd mobile && npm install && EXPO_PUBLIC_API_URL=http://<IP-máy-backend>:4000 npx expo start` (điện thoại thật dùng IP LAN, Android emulator dùng `10.0.2.2`).

## Tài khoản & mã vé mẫu
- Admin: `admin / Admin@123` (toàn quyền) · Staff: `staff / Staff@123` (nội dung + vé). **Đổi mật khẩu khi triển khai.**
- Mã vé dùng thử: `DEMO-0001` … `DEMO-0010`.

## Trang quản trị
Tổng quan (thống kê lượt nghe, top câu chuyện, bản dịch còn thiếu) · Câu chuyện (CRUD, 3 tab ngôn ngữ, upload ảnh/audio, tọa độ GPS, vị trí sơ đồ, bán kính tự phát, nghe thử TTS, xuất bản/nháp, nghe thử miễn phí) · Khu/nhóm tháp · Vé (loại vé, phát hành lô, thu hồi, lọc, xuất CSV) · Người dùng (Admin/Staff) · Cấu hình (ngôn ngữ, thông tin site, đổi mật khẩu) · Nhật ký thao tác.

## Thiết kế dữ liệu (SQL Server)
`Users`, `Languages` (chỉ vi/en/zh – có CHECK), `ZoneGroups`, `Stories` + `StoryTranslations` (tách nội dung theo ngôn ngữ, UNIQUE(StoryId, LanguageId)), `TicketTypes`, `Tickets`, `ListenLogs`, `AuditLogs`, `AppSettings`; view `vw_StoryOverview`, `vw_DailyListens`; đầy đủ khóa chính/ngoại, CHECK, index.

## Lưu ý trung thực về dữ liệu
- Nội dung 40 câu chuyện được biên soạn từ kiến thức lịch sử – di sản công khai về Mỹ Sơn (niên đại, tên nhóm tháp, sự kiện 1898/1969/1999…). **Hãy đối chiếu với tài liệu của Ban quản lý di tích** trước khi nộp/triển khai; các bản dịch tiếng Trung nên nhờ người thông thạo hiệu đính.
- Tọa độ GPS và vị trí trên sơ đồ là **ước lượng**, cần đo thực địa rồi chỉnh trong Admin. Giá vé là minh họa.
- Ảnh minh họa chưa có (hiển thị nền hoa văn) – tải ảnh có bản quyền trong Admin.
- Giọng đọc dùng TTS của thiết bị; tiếng Trung/Việt cần máy có sẵn giọng tương ứng (hoặc tải file audio thu sẵn trong Admin).

## Ghi chú kỹ thuật
- Vé: kích hoạt nguyên tử (`UPDATE … WHERE Status='Unused'`), trả JWT khách có hạn bằng thời hạn vé; mỗi lần xem nội dung có kiểm tra vé chưa bị thu hồi. Giới hạn tần suất nhập mã/đăng nhập.
- Bảo mật: bcrypt, JWT, helmet, CORS theo danh sách, tham số hóa mọi truy vấn, kiểm tra upload (loại file, dung lượng, tên ngẫu nhiên).
- Dữ liệu seed sinh bằng `node database/build.js` (sửa nội dung trong `database/src/content.js`).
