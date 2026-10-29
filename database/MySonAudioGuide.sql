/* =====================================================================
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

/* ---------- 1. XÓA BẢNG CŨ (đúng thứ tự khóa ngoại) ---------- */
IF OBJECT_ID(N'dbo.vw_DailyListens', N'V') IS NOT NULL DROP VIEW dbo.vw_DailyListens;
IF OBJECT_ID(N'dbo.vw_StoryOverview', N'V') IS NOT NULL DROP VIEW dbo.vw_StoryOverview;
IF OBJECT_ID(N'dbo.AppSettings', N'U') IS NOT NULL DROP TABLE dbo.AppSettings;
IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NOT NULL DROP TABLE dbo.AuditLogs;
IF OBJECT_ID(N'dbo.ListenLogs', N'U') IS NOT NULL DROP TABLE dbo.ListenLogs;
IF OBJECT_ID(N'dbo.Tickets', N'U') IS NOT NULL DROP TABLE dbo.Tickets;
IF OBJECT_ID(N'dbo.TicketTypes', N'U') IS NOT NULL DROP TABLE dbo.TicketTypes;
IF OBJECT_ID(N'dbo.StoryTranslations', N'U') IS NOT NULL DROP TABLE dbo.StoryTranslations;
IF OBJECT_ID(N'dbo.Stories', N'U') IS NOT NULL DROP TABLE dbo.Stories;
IF OBJECT_ID(N'dbo.ZoneGroups', N'U') IS NOT NULL DROP TABLE dbo.ZoneGroups;
IF OBJECT_ID(N'dbo.Languages', N'U') IS NOT NULL DROP TABLE dbo.Languages;
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL DROP TABLE dbo.Users;
GO

/* ---------- 2. TẠO BẢNG ---------- */

-- Người dùng quản trị (Admin: toàn quyền; Staff: quản lý nội dung & phát hành vé)
CREATE TABLE dbo.Users (
    UserId       INT IDENTITY(1,1) CONSTRAINT PK_Users PRIMARY KEY,
    Username     NVARCHAR(50)  NOT NULL CONSTRAINT UQ_Users_Username UNIQUE,
    PasswordHash NVARCHAR(200) NOT NULL,                       -- bcrypt
    FullName     NVARCHAR(100) NOT NULL,
    Email        NVARCHAR(150) NULL,
    Role         NVARCHAR(20)  NOT NULL CONSTRAINT DF_Users_Role DEFAULT N'Staff'
                 CONSTRAINT CK_Users_Role CHECK (Role IN (N'Admin', N'Staff')),
    IsActive     BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    CreatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    LastLoginAt  DATETIME2(0) NULL
);

-- Ngôn ngữ thuyết minh: đồ án chỉ hỗ trợ 3 ngôn ngữ Việt - Anh - Trung
CREATE TABLE dbo.Languages (
    LanguageId INT IDENTITY(1,1) CONSTRAINT PK_Languages PRIMARY KEY,
    Code       NVARCHAR(10)  NOT NULL CONSTRAINT UQ_Languages_Code UNIQUE
               CONSTRAINT CK_Languages_Code CHECK (Code IN (N'vi', N'en', N'zh')),
    Name       NVARCHAR(60)  NOT NULL,                         -- tên tiếng Anh
    NativeName NVARCHAR(60)  NOT NULL,                         -- tên bản ngữ
    TtsLocale  NVARCHAR(15)  NOT NULL,                         -- locale Text-to-Speech: vi-VN, en-US, zh-CN
    IsActive   BIT NOT NULL CONSTRAINT DF_Languages_IsActive DEFAULT 1,
    SortOrder  INT NOT NULL CONSTRAINT DF_Languages_SortOrder DEFAULT 0
);

-- Khu / nhóm tháp
CREATE TABLE dbo.ZoneGroups (
    ZoneId      INT IDENTITY(1,1) CONSTRAINT PK_ZoneGroups PRIMARY KEY,
    Code        NVARCHAR(10)  NOT NULL CONSTRAINT UQ_ZoneGroups_Code UNIQUE,
    NameVi      NVARCHAR(150) NOT NULL,
    NameEn      NVARCHAR(150) NOT NULL,
    NameZh      NVARCHAR(150) NOT NULL,
    Description NVARCHAR(500) NULL,
    SortOrder   INT NOT NULL CONSTRAINT DF_ZoneGroups_SortOrder DEFAULT 0
);

-- Câu chuyện (điểm thuyết minh)
CREATE TABLE dbo.Stories (
    StoryId        INT IDENTITY(1,1) CONSTRAINT PK_Stories PRIMARY KEY,
    Code           NVARCHAR(20)  NOT NULL CONSTRAINT UQ_Stories_Code UNIQUE,   -- mã in trên QR tại điểm tham quan
    ZoneId         INT NOT NULL CONSTRAINT FK_Stories_Zone REFERENCES dbo.ZoneGroups(ZoneId),
    SortOrder      INT NOT NULL CONSTRAINT DF_Stories_SortOrder DEFAULT 0,
    ImageUrl       NVARCHAR(400) NULL,
    Latitude       DECIMAL(9,6) NULL,
    Longitude      DECIMAL(9,6) NULL,
    MapX           DECIMAL(5,2) NULL CONSTRAINT CK_Stories_MapX CHECK (MapX BETWEEN 0 AND 100),  -- vị trí trên sơ đồ (%)
    MapY           DECIMAL(5,2) NULL CONSTRAINT CK_Stories_MapY CHECK (MapY BETWEEN 0 AND 100),
    TriggerRadiusM INT NOT NULL CONSTRAINT DF_Stories_Radius DEFAULT 30        -- bán kính tự động phát (mét)
                   CONSTRAINT CK_Stories_Radius CHECK (TriggerRadiusM BETWEEN 5 AND 500),
    IsPublished    BIT NOT NULL CONSTRAINT DF_Stories_IsPublished DEFAULT 1,
    IsPreview      BIT NOT NULL CONSTRAINT DF_Stories_IsPreview DEFAULT 0,     -- nghe thử không cần vé
    CreatedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_Stories_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_Stories_UpdatedAt DEFAULT SYSUTCDATETIME()
);

-- Nội dung câu chuyện theo từng ngôn ngữ
CREATE TABLE dbo.StoryTranslations (
    TranslationId INT IDENTITY(1,1) CONSTRAINT PK_StoryTranslations PRIMARY KEY,
    StoryId    INT NOT NULL CONSTRAINT FK_ST_Story REFERENCES dbo.Stories(StoryId) ON DELETE CASCADE,
    LanguageId INT NOT NULL CONSTRAINT FK_ST_Language REFERENCES dbo.Languages(LanguageId),
    Title      NVARCHAR(200)  NOT NULL,
    Summary    NVARCHAR(500)  NULL,               -- mô tả ngắn hiển thị ở danh sách
    Content    NVARCHAR(MAX)  NOT NULL,           -- văn bản thuyết minh (đọc bằng TTS)
    AudioUrl   NVARCHAR(400)  NULL,               -- (tùy chọn) file âm thanh thu sẵn; trống thì dùng TTS
    CONSTRAINT UQ_ST_Story_Language UNIQUE (StoryId, LanguageId)
);

-- Loại vé
CREATE TABLE dbo.TicketTypes (
    TicketTypeId INT IDENTITY(1,1) CONSTRAINT PK_TicketTypes PRIMARY KEY,
    Name         NVARCHAR(100) NOT NULL,
    ValidHours   INT NOT NULL CONSTRAINT CK_TT_Hours CHECK (ValidHours > 0),   -- hiệu lực sau khi kích hoạt
    Price        DECIMAL(12,0) NOT NULL CONSTRAINT DF_TT_Price DEFAULT 0,
    IsActive     BIT NOT NULL CONSTRAINT DF_TT_IsActive DEFAULT 1
);

-- Vé / mã truy cập app
CREATE TABLE dbo.Tickets (
    TicketId     INT IDENTITY(1,1) CONSTRAINT PK_Tickets PRIMARY KEY,
    Code         NVARCHAR(20) NOT NULL CONSTRAINT UQ_Tickets_Code UNIQUE,
    TicketTypeId INT NOT NULL CONSTRAINT FK_Tickets_Type REFERENCES dbo.TicketTypes(TicketTypeId),
    BatchCode    NVARCHAR(30) NULL,                                       -- nhóm vé phát hành cùng lúc
    Status       NVARCHAR(15) NOT NULL CONSTRAINT DF_Tickets_Status DEFAULT N'Unused'
                 CONSTRAINT CK_Tickets_Status CHECK (Status IN (N'Unused', N'Activated', N'Revoked')),
    IssuedBy     INT NULL CONSTRAINT FK_Tickets_IssuedBy REFERENCES dbo.Users(UserId) ON DELETE SET NULL,
    IssuedAt     DATETIME2(0) NOT NULL CONSTRAINT DF_Tickets_IssuedAt DEFAULT SYSUTCDATETIME(),
    ActivatedAt  DATETIME2(0) NULL,
    ExpiresAt    DATETIME2(0) NULL,
    LanguageId   INT NULL CONSTRAINT FK_Tickets_Language REFERENCES dbo.Languages(LanguageId)  -- ngôn ngữ khách chọn khi kích hoạt
);

-- Nhật ký nghe (phục vụ thống kê)
CREATE TABLE dbo.ListenLogs (
    LogId      BIGINT IDENTITY(1,1) CONSTRAINT PK_ListenLogs PRIMARY KEY,
    StoryId    INT NOT NULL CONSTRAINT FK_LL_Story REFERENCES dbo.Stories(StoryId) ON DELETE CASCADE,
    LanguageId INT NOT NULL CONSTRAINT FK_LL_Language REFERENCES dbo.Languages(LanguageId),
    TicketId   INT NULL CONSTRAINT FK_LL_Ticket REFERENCES dbo.Tickets(TicketId) ON DELETE SET NULL,
    Source     NVARCHAR(10) NOT NULL CONSTRAINT DF_LL_Source DEFAULT N'web'
               CONSTRAINT CK_LL_Source CHECK (Source IN (N'web', N'mobile')),
    Mode       NVARCHAR(10) NOT NULL CONSTRAINT DF_LL_Mode DEFAULT N'manual'
               CONSTRAINT CK_LL_Mode CHECK (Mode IN (N'manual', N'auto')),   -- auto = tự phát theo GPS
    ListenedAt DATETIME2(0) NOT NULL CONSTRAINT DF_LL_At DEFAULT SYSUTCDATETIME()
);

-- Nhật ký thao tác quản trị
CREATE TABLE dbo.AuditLogs (
    AuditId   BIGINT IDENTITY(1,1) CONSTRAINT PK_AuditLogs PRIMARY KEY,
    UserId    INT NULL CONSTRAINT FK_Audit_User REFERENCES dbo.Users(UserId) ON DELETE SET NULL,
    Action    NVARCHAR(30)  NOT NULL,      -- CREATE / UPDATE / DELETE / LOGIN / REVOKE ...
    Entity    NVARCHAR(40)  NOT NULL,
    EntityId  NVARCHAR(40)  NULL,
    Detail    NVARCHAR(500) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Audit_At DEFAULT SYSUTCDATETIME()
);

-- Cấu hình hiển thị chung (tên đơn vị, giờ mở cửa, hotline...)
CREATE TABLE dbo.AppSettings (
    SettingKey   NVARCHAR(50)  NOT NULL CONSTRAINT PK_AppSettings PRIMARY KEY,
    SettingValue NVARCHAR(500) NOT NULL,
    UpdatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_AppSettings_At DEFAULT SYSUTCDATETIME()
);
GO

/* ---------- 3. INDEX ---------- */
CREATE INDEX IX_Stories_Zone_Sort ON dbo.Stories (ZoneId, SortOrder);
CREATE INDEX IX_ST_Language ON dbo.StoryTranslations (LanguageId);
CREATE INDEX IX_Tickets_Status ON dbo.Tickets (Status, ExpiresAt);
CREATE INDEX IX_Tickets_Batch ON dbo.Tickets (BatchCode);
CREATE INDEX IX_ListenLogs_At ON dbo.ListenLogs (ListenedAt) INCLUDE (StoryId, LanguageId, Source, Mode);
CREATE INDEX IX_ListenLogs_Story ON dbo.ListenLogs (StoryId);
CREATE INDEX IX_Audit_At ON dbo.AuditLogs (CreatedAt DESC);
GO

/* ---------- 4. VIEW ---------- */
-- Tổng quan câu chuyện: ngôn ngữ đã có nội dung / có file âm thanh / lượt nghe
CREATE VIEW dbo.vw_StoryOverview AS
SELECT s.StoryId, s.Code, s.SortOrder, s.IsPublished, s.IsPreview,
       z.Code AS ZoneCode, z.NameVi AS ZoneName,
       (SELECT STRING_AGG(l.Code, N',') WITHIN GROUP (ORDER BY l.SortOrder)
          FROM dbo.StoryTranslations t JOIN dbo.Languages l ON l.LanguageId = t.LanguageId
         WHERE t.StoryId = s.StoryId) AS Languages,
       (SELECT COUNT(*) FROM dbo.StoryTranslations t WHERE t.StoryId = s.StoryId AND t.AudioUrl IS NOT NULL) AS AudioFiles,
       (SELECT COUNT(*) FROM dbo.ListenLogs g WHERE g.StoryId = s.StoryId) AS TotalListens
FROM dbo.Stories s JOIN dbo.ZoneGroups z ON z.ZoneId = s.ZoneId;
GO

-- Lượt nghe theo ngày
CREATE VIEW dbo.vw_DailyListens AS
SELECT CAST(ListenedAt AS DATE) AS ListenDate, COUNT(*) AS Listens
FROM dbo.ListenLogs
GROUP BY CAST(ListenedAt AS DATE);
GO

/* ---------- 5. DỮ LIỆU ---------- */
INSERT INTO dbo.Users (Username, PasswordHash, FullName, Email, Role) VALUES
 (N'admin', N'$2a$10$asJiHDm9y7GzCYzlJQApiOuCNbXXsmvVHiK0Jc0ImRzq1NMRSHthy', N'Quản trị viên', N'admin@myson.local', N'Admin'),
 (N'staff', N'$2a$10$mOxohrWwwLCgJLpR9bRLSu9koQBvn23qQ/RgxkKgDD3MD5RcJFUsi', N'Nhân viên bán vé', N'staff@myson.local', N'Staff');

INSERT INTO dbo.Languages (Code, Name, NativeName, TtsLocale, SortOrder) VALUES
 (N'vi', N'Vietnamese', N'Tiếng Việt', N'vi-VN', 1),
 (N'en', N'English',    N'English',    N'en-US', 2),
 (N'zh', N'Chinese',    N'中文',        N'zh-CN', 3);

INSERT INTO dbo.ZoneGroups (Code, NameVi, NameEn, NameZh, Description, SortOrder) VALUES
 (N'TQ', N'Tổng quan & lịch sử', N'Overview & History', N'概览与历史', N'Giới thiệu chung về thánh địa và lịch sử phát hiện', 1),
 (N'A', N'Nhóm A – A''', N'Group A – A''', N'A组与A′组', N'Nhóm tháp có tháp A1 nổi tiếng bị bom phá hủy năm 1969', 2),
 (N'BCD', N'Nhóm B – C – D', N'Groups B – C – D', N'B、C、D组', N'Cụm đền tháp trung tâm của thánh địa', 3),
 (N'EF', N'Nhóm E – F', N'Groups E – F', N'E、F组', N'Nhóm tháp gắn với phong cách nghệ thuật Mỹ Sơn E1', 4),
 (N'G', N'Nhóm G', N'Group G', N'G组', N'Nhóm tháp thế kỷ mười hai', 5),
 (N'HK', N'Nhóm H – K', N'Groups H – K', N'H、K组', N'Các cụm tháp nhỏ hơn trong thung lũng', 6),
 (N'VH', N'Văn hóa & bảo tồn', N'Culture & Conservation', N'文化与保护', N'Nghệ thuật, kỹ thuật xây dựng, văn hóa Chăm và công tác bảo tồn', 7);

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
 (N'MS01', N'TQ', 1, 15.7618, 108.12264, 14.2, 84, 1),
 (N'MS02', N'TQ', 2, 15.761838, 108.122558, 9.71, 86.1, 1),
 (N'MS03', N'A', 3, 15.7642, 108.12144, 24.2, 26, 1),
 (N'MS04', N'BCD', 4, 15.7637, 108.12384, 50.2, 46, 0),
 (N'MS05', N'BCD', 5, 15.763738, 108.123758, 45.71, 48.1, 0),
 (N'MS06', N'BCD', 6, 15.763631, 108.123806, 48.33, 42.2, 0),
 (N'MS07', N'EF', 7, 15.765, 108.12504, 72.2, 28, 0),
 (N'MS08', N'G', 8, 15.7627, 108.12524, 80.2, 66, 0),
 (N'MS09', N'HK', 9, 15.7658, 108.12664, 92.2, 44, 0),
 (N'MS10', N'HK', 10, 15.765838, 108.126558, 87.71, 46.1, 0),
 (N'MS11', N'VH', 11, 15.7633, 108.12434, 60.2, 62, 0),
 (N'MS12', N'VH', 12, 15.763338, 108.124258, 55.71, 64.1, 0),
 (N'MS13', N'VH', 13, 15.763231, 108.124306, 58.33, 58.2, 0),
 (N'MS14', N'TQ', 14, 15.761731, 108.122606, 12.33, 80.2, 0),
 (N'MS15', N'TQ', 15, 15.761863, 108.122649, 14.68, 87.49, 0),
 (N'MS16', N'TQ', 16, 15.761784, 108.122512, 7.16, 83.14, 0),
 (N'MS17', N'VH', 17, 15.763363, 108.124349, 60.68, 65.49, 0),
 (N'MS18', N'VH', 18, 15.763284, 108.124212, 53.16, 61.14, 0),
 (N'MS19', N'A', 19, 15.764238, 108.121358, 19.71, 28.1, 0),
 (N'MS20', N'BCD', 20, 15.763763, 108.123849, 50.68, 49.49, 0),
 (N'MS21', N'BCD', 21, 15.763684, 108.123712, 43.16, 45.14, 0),
 (N'MS22', N'BCD', 22, 15.763647, 108.123883, 52.55, 43.11, 0),
 (N'MS23', N'VH', 23, 15.763247, 108.124383, 62.55, 59.11, 0),
 (N'MS24', N'EF', 24, 15.765038, 108.124958, 67.71, 30.1, 0),
 (N'MS25', N'EF', 25, 15.764931, 108.125006, 70.33, 24.2, 0),
 (N'MS26', N'EF', 26, 15.765063, 108.125049, 72.68, 31.49, 0),
 (N'MS27', N'G', 27, 15.762738, 108.125158, 75.71, 68.1, 0),
 (N'MS28', N'HK', 28, 15.765731, 108.126606, 90.33, 40.2, 0),
 (N'MS29', N'VH', 29, 15.763402, 108.124273, 56.49, 67.62, 0),
 (N'MS30', N'VH', 30, 15.7632, 108.124248, 55.13, 56.48, 0),
 (N'MS31', N'VH', 31, 15.763341, 108.124413, 64.2, 64.27, 0),
 (N'MS32', N'VH', 32, 15.763348, 108.124183, 51.57, 64.65, 0),
 (N'MS33', N'VH', 33, 15.76318, 108.124356, 61.1, 55.39, 0),
 (N'MS34', N'VH', 34, 15.763432, 108.124341, 60.28, 69.27, 0),
 (N'MS35', N'VH', 35, 15.763228, 108.124175, 51.14, 58.02, 0),
 (N'MS36', N'TQ', 36, 15.761747, 108.122683, 16.55, 81.11, 0),
 (N'MS37', N'A', 37, 15.764131, 108.121406, 22.33, 22.2, 0),
 (N'MS38', N'VH', 38, 15.763268, 108.124446, 66.04, 60.24, 0),
 (N'MS39', N'VH', 39, 15.763427, 108.124211, 53.1, 68.97, 0),
 (N'MS40', N'TQ', 40, 15.761902, 108.122573, 10.49, 89.62, 0)
) v(Code, ZoneCode, SortOrder, Lat, Lng, MapX, MapY, IsPreview)
JOIN dbo.ZoneGroups z ON z.Code = v.ZoneCode;

-- COLLATE DATABASE_DEFAULT: tránh lỗi xung đột collation giữa tempdb và CSDL (Vietnamese_100_CI_AI)
CREATE TABLE #T (StoryCode NVARCHAR(20) COLLATE DATABASE_DEFAULT, LangCode NVARCHAR(10) COLLATE DATABASE_DEFAULT,
                 Title NVARCHAR(200), Summary NVARCHAR(500), Content NVARCHAR(MAX));

/* ----- Tiếng Việt ----- */
INSERT INTO #T VALUES
(N'MS01', N'vi', N'Giới thiệu Thánh địa Mỹ Sơn', N'Thánh địa Mỹ Sơn nằm trong một thung lũng kín đáo, bao quanh bởi núi non, thuộc vùng Duy Xuyên, Quảng Nam, nay thuộc thành phố Đà Nẵng.',
 N'Thánh địa Mỹ Sơn nằm trong một thung lũng kín đáo, bao quanh bởi núi non, thuộc vùng Duy Xuyên, Quảng Nam, nay thuộc thành phố Đà Nẵng. Từ thế kỷ thứ tư đến thế kỷ thứ mười ba, các vị vua Chăm Pa đã xây dựng tại đây hàng chục đền tháp để thờ thần Siva và tôn vinh tổ tiên hoàng tộc. Năm một nghìn chín trăm chín mươi chín, UNESCO công nhận Mỹ Sơn là Di sản văn hóa thế giới. Mời bạn cùng bước vào hành trình khám phá nơi được xem là một trong những trung tâm tôn giáo quan trọng nhất của vương quốc Chăm Pa.'),
(N'MS02', N'vi', N'Vua Bhadravarman và ngôi đền đầu tiên', N'Theo bia ký còn lại, vào cuối thế kỷ thứ tư, vua Bhadravarman đã cho dựng tại thung lũng này ngôi đền thờ thần Bhadreshvara, đặt nền móng cho thánh địa.',
 N'Theo bia ký còn lại, vào cuối thế kỷ thứ tư, vua Bhadravarman đã cho dựng tại thung lũng này ngôi đền thờ thần Bhadreshvara, đặt nền móng cho thánh địa. Ngôi đền ban đầu làm bằng gỗ nên đã bị hỏa hoạn thiêu rụi. Sau đó, các vị vua kế tiếp liên tục trùng tu và xây mới bằng gạch, biến Mỹ Sơn thành nơi hành lễ của các triều đại trong suốt hơn chín trăm năm.'),
(N'MS03', N'vi', N'Nhóm A và tháp A1', N'Nhóm A từng có tháp chính A1, cao khoảng hai mươi bốn mét, được đánh giá là công trình hoành tráng và đẹp nhất của Mỹ Sơn.',
 N'Nhóm A từng có tháp chính A1, cao khoảng hai mươi bốn mét, được đánh giá là công trình hoành tráng và đẹp nhất của Mỹ Sơn. Năm một nghìn chín trăm sáu mươi chín, trong chiến tranh, bom đã phá hủy gần như hoàn toàn tháp A1 cùng nhiều công trình lân cận. Hôm nay, những mảng gạch còn sót lại nhắc chúng ta về giá trị của việc gìn giữ di sản.'),
(N'MS04', N'vi', N'Nhóm B – ngôi đền thờ thần Bhadreshvara', N'Nhóm B gồm tháp chính B1, còn gọi là Kalan, được xem là trung tâm tín ngưỡng của khu đền, thờ linga của thần Bhadreshvara.',
 N'Nhóm B gồm tháp chính B1, còn gọi là Kalan, được xem là trung tâm tín ngưỡng của khu đền, thờ linga của thần Bhadreshvara. Kalan có mặt bằng vuông, cửa mở về hướng đông, bên trong là gian thờ nhỏ và tối, tượng trưng cho hang núi thiêng. Các tháp nhỏ xung quanh dùng để thờ các vị thần hộ pháp và cất giữ vật cúng.'),
(N'MS05', N'vi', N'Nhóm C và tháp C1', N'Nhóm C nổi tiếng với tháp C1, một trong những công trình được bảo tồn tốt nhất tại Mỹ Sơn, có niên đại khoảng thế kỷ thứ tám.',
 N'Nhóm C nổi tiếng với tháp C1, một trong những công trình được bảo tồn tốt nhất tại Mỹ Sơn, có niên đại khoảng thế kỷ thứ tám. Các nhà nghiên cứu cho rằng đây là nơi thờ thần Siva, vị thần tối cao trong tín ngưỡng của người Chăm xưa. Hãy chú ý các họa tiết trang trí trên trụ ốp và vòm cửa, thể hiện tay nghề điêu khắc gạch tinh xảo.'),
(N'MS06', N'vi', N'Nhóm D – nơi trưng bày điêu khắc Chăm', N'Hai công trình D1 và D2 hiện được sử dụng làm nơi trưng bày các hiện vật điêu khắc đá sa thạch tìm thấy ở Mỹ Sơn như tượng thần, linga, bệ thờ và các phù điêu.',
 N'Hai công trình D1 và D2 hiện được sử dụng làm nơi trưng bày các hiện vật điêu khắc đá sa thạch tìm thấy ở Mỹ Sơn như tượng thần, linga, bệ thờ và các phù điêu. Qua đó, du khách có thể quan sát gần hơn phong cách nghệ thuật Chăm qua nhiều giai đoạn lịch sử.'),
(N'MS07', N'vi', N'Nhóm E – F và phong cách nghệ thuật Mỹ Sơn E1', N'Phong cách Mỹ Sơn E1, vào khoảng thế kỷ thứ bảy đến thứ tám, lấy tên từ tháp E1 và được xem là một trong những giai đoạn nghệ thuật Chăm sớm và đẹp nhất.',
 N'Phong cách Mỹ Sơn E1, vào khoảng thế kỷ thứ bảy đến thứ tám, lấy tên từ tháp E1 và được xem là một trong những giai đoạn nghệ thuật Chăm sớm và đẹp nhất. Đặc trưng nổi bật là các bệ thờ chạm nổi, với những hình người, thú và hoa lá sinh động. Nhiều hiện vật quan trọng của nhóm tháp này hiện được bảo quản trong các bảo tàng điêu khắc Chăm.'),
(N'MS08', N'vi', N'Nhóm G', N'Nhóm G là cụm tháp có niên đại khoảng thế kỷ mười hai, với tháp chính G1 đồ sộ, các tầng mái thu nhỏ dần lên cao.',
 N'Nhóm G là cụm tháp có niên đại khoảng thế kỷ mười hai, với tháp chính G1 đồ sộ, các tầng mái thu nhỏ dần lên cao. Đây là giai đoạn nghệ thuật Chăm mang nhiều nét kiến trúc đặc trưng của thời kỳ muộn, khi vương quốc vẫn tiếp tục xây dựng và tôn tạo thánh địa.'),
(N'MS09', N'vi', N'Nhóm H', N'Nhóm H là một cụm tháp nhỏ hơn trong thung lũng.',
 N'Nhóm H là một cụm tháp nhỏ hơn trong thung lũng. Sự có mặt của các nhóm tháp như H cho thấy thánh địa được xây dựng và mở rộng liên tục qua nhiều triều đại, mỗi giai đoạn để lại dấu ấn riêng về kỹ thuật và phong cách trang trí.'),
(N'MS10', N'vi', N'Nhóm K', N'Nhóm K gồm các tháp có quy mô nhỏ nằm ở rìa khu thánh địa.',
 N'Nhóm K gồm các tháp có quy mô nhỏ nằm ở rìa khu thánh địa. Dù không đồ sộ như nhóm tháp trung tâm, nhóm K vẫn góp phần hoàn chỉnh bức tranh về cách người Chăm bố trí không gian thiêng, nơi mỗi cụm tháp có một vai trò riêng.'),
(N'MS11', N'vi', N'Bí ẩn gạch Chăm', N'Người Chăm xây tháp bằng gạch nung, các viên gạch được ghép sít đến mức gần như không thấy mạch vữa.',
 N'Người Chăm xây tháp bằng gạch nung, các viên gạch được ghép sít đến mức gần như không thấy mạch vữa. Cho đến nay, giới nghiên cứu vẫn chưa thống nhất về chất kết dính được sử dụng; có giả thuyết cho rằng đó là một loại nhựa cây trộn với đất sét. Kỹ thuật chạm khắc trực tiếp lên thân tháp sau khi xây cũng là điểm đặc sắc của kiến trúc Chăm.'),
(N'MS12', N'vi', N'Múa Apsara và văn hóa Chăm', N'Apsara là những vũ nữ thiên thần trong thần thoại Ấn Độ, được thể hiện nhiều trên các phù điêu Chăm.',
 N'Apsara là những vũ nữ thiên thần trong thần thoại Ấn Độ, được thể hiện nhiều trên các phù điêu Chăm. Tại Mỹ Sơn, du khách thường được thưởng thức các điệu múa Chăm với trang phục và nhạc cụ truyền thống như trống Ginăng và kèn Saranai, giúp hình dung không khí lễ hội xưa kia.'),
(N'MS13', N'vi', N'Bảo tồn và Di sản thế giới', N'Từ thập niên một nghìn chín trăm tám mươi, nhiều chuyên gia trong và ngoài nước, trong đó có kiến trúc sư người Ba Lan Kazimierz Kwiatkowski, đã tham gia nghiên cứu và trùng tu Mỹ Sơn.',
 N'Từ thập niên một nghìn chín trăm tám mươi, nhiều chuyên gia trong và ngoài nước, trong đó có kiến trúc sư người Ba Lan Kazimierz Kwiatkowski, đã tham gia nghiên cứu và trùng tu Mỹ Sơn. Năm một nghìn chín trăm chín mươi chín, UNESCO ghi danh Mỹ Sơn vào danh sách Di sản thế giới nhờ giá trị đặc biệt về giao lưu văn hóa và là minh chứng của một nền văn minh đã biến mất.'),
(N'MS14', N'vi', N'Phát hiện Mỹ Sơn năm 1898', N'Năm một nghìn tám trăm chín mươi tám, kỹ sư người Pháp Camille Paris phát hiện lại quần thể đền tháp bị rừng che phủ.',
 N'Năm một nghìn tám trăm chín mươi tám, kỹ sư người Pháp Camille Paris phát hiện lại quần thể đền tháp bị rừng che phủ. Sau đó, Henri Parmentier và các nhà nghiên cứu của Viện Viễn Đông Bác Cổ Pháp khảo sát, đánh dấu các cụm tháp bằng chữ cái để dễ nghiên cứu. Cách đặt tên nhóm tháp theo chữ cái ấy vẫn được dùng đến ngày nay.'),
(N'MS15', N'vi', N'Thung lũng thiêng và núi Mahaparvata', N'Thung lũng Mỹ Sơn rộng chừng hai kilômét, được che chở bởi những dãy đồi thấp bao quanh.',
 N'Thung lũng Mỹ Sơn rộng chừng hai kilômét, được che chở bởi những dãy đồi thấp bao quanh. Ở phía tây nổi lên ngọn núi Răng Mèo, được người Chăm xưa xem là núi thiêng Mahaparvata, nơi cư ngụ của thần linh. Con suối Khe Thẻ chảy qua thung lũng, và theo quan niệm Ấn Độ giáo, dòng nước ấy gắn với sự thanh tẩy trong các nghi lễ. Chính cảnh quan này đã khiến các vị vua Chăm chọn nơi đây làm thánh địa.'),
(N'MS16', N'vi', N'Vương quốc Chăm Pa', N'Chăm Pa là vương quốc hình thành từ cuối thế kỷ thứ hai, trải dài dọc miền Trung Việt Nam ngày nay.',
 N'Chăm Pa là vương quốc hình thành từ cuối thế kỷ thứ hai, trải dài dọc miền Trung Việt Nam ngày nay. Các trung tâm quan trọng lần lượt là Simhapura gần Trà Kiệu, Indrapura ở Đồng Dương và Vijaya ở Bình Định. Cư dân sống bằng nông nghiệp, đánh cá và buôn bán đường biển, tiếp thu văn hóa Ấn Độ rồi tạo nên một nền nghệ thuật rất riêng. Mỹ Sơn là trung tâm tôn giáo gắn với các triều đại của vương quốc này.'),
(N'MS17', N'vi', N'Thần Siva, linga và yoni', N'Phần lớn đền tháp Mỹ Sơn thờ thần Siva, một trong ba vị thần chính của Ấn Độ giáo.',
 N'Phần lớn đền tháp Mỹ Sơn thờ thần Siva, một trong ba vị thần chính của Ấn Độ giáo. Thần thường được thể hiện dưới dạng linga, một trụ đá hình trụ, đặt trên bệ yoni tượng trưng cho nữ thần. Sự kết hợp ấy biểu tượng cho sức sáng tạo và sự sinh sôi của vũ trụ. Các vị vua thường gắn tên mình vào tên vị thần để tôn vinh dòng dõi, chẳng hạn Bhadreshvara là thần Siva gắn với vua Bhadravarman.'),
(N'MS18', N'vi', N'Kiến trúc đền tháp Chăm', N'Một cụm đền Chăm thường có tháp chính gọi là Kalan, nhà dài để chuẩn bị lễ vật gọi là Mandapa, nhà kho cất vật cúng gọi là Kosagrha và cổng tháp gọi là Gopura.',
 N'Một cụm đền Chăm thường có tháp chính gọi là Kalan, nhà dài để chuẩn bị lễ vật gọi là Mandapa, nhà kho cất vật cúng gọi là Kosagrha và cổng tháp gọi là Gopura. Tháp chính được dựng như hình ảnh thu nhỏ của núi thần Meru, trung tâm của vũ trụ trong quan niệm Ấn Độ giáo. Các tầng mái nhỏ dần lên cao, mỗi tầng lặp lại hình dáng của tầng dưới, tạo nên cảm giác vươn lên trời cao.'),
(N'MS19', N'vi', N'Dấu vết chiến tranh và hố bom', N'Năm một nghìn chín trăm sáu mươi chín, các đợt ném bom đã làm hư hại nặng nhiều nhóm tháp ở Mỹ Sơn.',
 N'Năm một nghìn chín trăm sáu mươi chín, các đợt ném bom đã làm hư hại nặng nhiều nhóm tháp ở Mỹ Sơn. Trong khu di tích vẫn còn những hố bom lớn như một chứng tích lặng lẽ của chiến tranh. Chính sự mất mát ấy đã thúc đẩy giới chuyên môn và cộng đồng quốc tế quan tâm hơn đến việc bảo vệ di sản. Xin du khách giữ yên lặng và đi đúng lối dành cho khách tham quan.'),
(N'MS20', N'vi', N'Mandapa – gian nhà đón tín đồ', N'Mandapa là gian nhà phía trước tháp chính, nơi các tu sĩ chuẩn bị lễ vật và tín đồ tập trung trước khi vào lễ.',
 N'Mandapa là gian nhà phía trước tháp chính, nơi các tu sĩ chuẩn bị lễ vật và tín đồ tập trung trước khi vào lễ. Mái nhà thường làm bằng ngói và gỗ nên phần lớn đã mất, chỉ còn lại nền móng và các hàng cột gạch. Khi bước đi giữa những vết tích này, bạn hãy hình dung không khí nhộn nhịp của ngày lễ xưa, với tiếng nhạc, hương trầm và những đoàn người dâng lễ.'),
(N'MS21', N'vi', N'Dòng nước thiêng', N'Trong gian thờ, nước dùng trong nghi lễ được rưới lên linga rồi chảy theo rãnh trên bệ yoni ra ngoài qua một máng đá gọi là somasutra.',
 N'Trong gian thờ, nước dùng trong nghi lễ được rưới lên linga rồi chảy theo rãnh trên bệ yoni ra ngoài qua một máng đá gọi là somasutra. Dòng nước ấy được xem là nước thiêng, tín đồ có thể hứng lấy để cầu phúc. Chi tiết nhỏ này cho thấy kiến trúc Chăm không chỉ để ngắm nhìn mà gắn chặt với nghi lễ sống động của người xưa.'),
(N'MS22', N'vi', N'Họa tiết Kala, Makara và Garuda', N'Trên cửa tháp và các trụ ốp, bạn có thể bắt gặp nhiều hình tượng thần thoại.',
 N'Trên cửa tháp và các trụ ốp, bạn có thể bắt gặp nhiều hình tượng thần thoại. Kala là mặt thú dữ canh giữ phía trên cửa, Makara là thủy quái đầu voi mình cá, còn Garuda là thần điểu vật cưỡi của thần Visnu. Cùng với hoa lá cuộn tròn và hình rắn thần Naga, những họa tiết này vừa trang trí vừa che chở cho nơi thờ tự.'),
(N'MS23', N'vi', N'Nghệ thuật điêu khắc sa thạch', N'Bên cạnh gạch, người Chăm còn dùng đá sa thạch để tạc tượng thần, bệ thờ và các cấu kiện trang trí.',
 N'Bên cạnh gạch, người Chăm còn dùng đá sa thạch để tạc tượng thần, bệ thờ và các cấu kiện trang trí. Nghệ thuật điêu khắc Chăm phát triển qua nhiều phong cách như Mỹ Sơn E1, Hòa Lai, Đồng Dương, Trà Kiệu và Tháp Mẫm. Mỗi phong cách có nét đặc trưng riêng về tỉ lệ cơ thể, nét mặt và cách tạo hình trang phục. Nhiều tác phẩm tiêu biểu hiện được trưng bày tại Bảo tàng Điêu khắc Chăm ở Đà Nẵng.'),
(N'MS24', N'vi', N'Bệ thờ Mỹ Sơn E1', N'Bệ thờ ở tháp E1 là một kiệt tác của điêu khắc Chăm, được chạm nổi nhiều cảnh sinh hoạt và thần thoại.',
 N'Bệ thờ ở tháp E1 là một kiệt tác của điêu khắc Chăm, được chạm nổi nhiều cảnh sinh hoạt và thần thoại. Trên bệ có hình các tu sĩ ngồi thiền, nhạc công, vũ nữ cùng những cây cối và thú vật xen kẽ. Hiện vật này được các nhà nghiên cứu đánh giá rất cao và hiện được bảo quản tại Bảo tàng Điêu khắc Chăm ở Đà Nẵng.'),
(N'MS25', N'vi', N'Các vị ẩn sĩ Rishi', N'Trong nhiều phù điêu Chăm, bạn sẽ thấy các ẩn sĩ Rishi với râu dài và búi tóc cao, ngồi thiền hoặc cầu nguyện.',
 N'Trong nhiều phù điêu Chăm, bạn sẽ thấy các ẩn sĩ Rishi với râu dài và búi tóc cao, ngồi thiền hoặc cầu nguyện. Rishi là những bậc hiền triết trong truyền thống Ấn Độ, tượng trưng cho trí tuệ và sự tu hành khắc khổ. Việc đưa hình ảnh họ vào nghệ thuật cho thấy người Chăm coi trọng đời sống tâm linh và sự thanh tịnh.'),
(N'MS26', N'vi', N'Nhóm F', N'Nhóm F gồm một số công trình nhỏ, phần lớn đã đổ nát và chỉ còn lại nền móng cùng vài đoạn tường gạch.',
 N'Nhóm F gồm một số công trình nhỏ, phần lớn đã đổ nát và chỉ còn lại nền móng cùng vài đoạn tường gạch. Dù vậy, vị trí của chúng bên cạnh nhóm E cho thấy các cụm tháp được bố trí gần nhau theo từng tổ hợp thờ tự. Những di tích khiêm tốn như thế cũng là tư liệu quý để các nhà khảo cổ nghiên cứu quy hoạch của thánh địa.'),
(N'MS27', N'vi', N'Tháp G1', N'Tháp G1 có thân tháp vuông với các tầng mái thu nhỏ dần, trên mỗi góc đặt những tháp nhỏ trang trí.',
 N'Tháp G1 có thân tháp vuông với các tầng mái thu nhỏ dần, trên mỗi góc đặt những tháp nhỏ trang trí. Mặt ngoài tường chia thành nhiều ô phẳng, tạo nhịp điệu rõ ràng cho tòa tháp. Đây là ví dụ đẹp của kiến trúc Chăm giai đoạn muộn, giúp du khách so sánh với tháp C1 để thấy sự thay đổi về hình dáng và cách trang trí qua khoảng bốn thế kỷ.'),
(N'MS28', N'vi', N'Con đường quanh thung lũng', N'Khi đi dọc theo thung lũng, bạn sẽ thấy các cụm tháp nằm rải rác giữa cây xanh, mỗi nơi có một vẻ riêng.',
 N'Khi đi dọc theo thung lũng, bạn sẽ thấy các cụm tháp nằm rải rác giữa cây xanh, mỗi nơi có một vẻ riêng. Những ngọn tháp nhỏ nổi lên giữa tán rừng cho cảm giác yên tĩnh, đúng với tinh thần của một nơi tu hành xưa. Hãy dành vài phút đứng lặng ngắm nhìn và lắng nghe tiếng rừng.'),
(N'MS29', N'vi', N'Văn bia Chăm', N'Tại Mỹ Sơn và các di tích Chăm khác, người xưa để lại nhiều văn bia khắc bằng chữ Phạn và chữ Chăm cổ.',
 N'Tại Mỹ Sơn và các di tích Chăm khác, người xưa để lại nhiều văn bia khắc bằng chữ Phạn và chữ Chăm cổ. Bia ký ghi lại việc vua dâng cúng đất đai, người hầu hạ và của cải cho đền, đồng thời ca ngợi công đức các triều vua. Nhờ những dòng chữ này, các nhà sử học dựng lại được nhiều mốc lịch sử của vương quốc, trong đó có việc vua Bhadravarman lập đền thờ thần.'),
(N'MS30', N'vi', N'Hợp tác quốc tế trong trùng tu', N'Công cuộc bảo tồn Mỹ Sơn có sự tham gia của nhiều nước.',
 N'Công cuộc bảo tồn Mỹ Sơn có sự tham gia của nhiều nước. Các chuyên gia Ba Lan làm việc tại đây từ thập niên một nghìn chín trăm tám mươi, sau đó là sự hỗ trợ của các tổ chức và chuyên gia Ý cùng một số nước khác, trong đó có Ấn Độ. Mỗi đợt trùng tu đều phải thận trọng, hạn chế thay thế vật liệu mới để giữ lại tối đa giá trị nguyên gốc của di tích.'),
(N'MS31', N'vi', N'Lễ hội Katê và cộng đồng Chăm ngày nay', N'Ngày nay, người Chăm vẫn sinh sống ở miền Trung và Nam Trung Bộ, giữ gìn tiếng nói, chữ viết và nhiều phong tục riêng.',
 N'Ngày nay, người Chăm vẫn sinh sống ở miền Trung và Nam Trung Bộ, giữ gìn tiếng nói, chữ viết và nhiều phong tục riêng. Lễ hội Katê được tổ chức hằng năm tại các tháp Chăm để tưởng nhớ thần linh và các vị vua anh hùng, với lễ dâng cúng, múa hát và rước trang phục truyền thống. Đó là minh chứng cho thấy văn hóa Chăm không chỉ nằm trong di tích mà vẫn đang sống trong cộng đồng.'),
(N'MS32', N'vi', N'Nhạc cụ Chăm', N'Âm nhạc là một phần không thể thiếu của lễ hội Chăm.',
 N'Âm nhạc là một phần không thể thiếu của lễ hội Chăm. Trống Ginăng và trống Baranưng tạo nhịp điệu mạnh mẽ, kèn Saranai cất lên giai điệu ngân vang, còn tiếng chiêng, trống tay và đàn Kanhi làm phong phú không gian âm thanh. Khi nghe những âm thanh này tại Mỹ Sơn, bạn như được trở về với những buổi lễ dâng cúng ở các ngôi đền hàng trăm năm trước.'),
(N'MS33', N'vi', N'Trà Kiệu – kinh đô Simhapura', N'Không xa Mỹ Sơn là Trà Kiệu, được cho là vị trí của kinh đô Simhapura, nghĩa là thành phố sư tử.',
 N'Không xa Mỹ Sơn là Trà Kiệu, được cho là vị trí của kinh đô Simhapura, nghĩa là thành phố sư tử. Các cuộc khai quật tại đây đã tìm thấy nhiều hiện vật quan trọng như bệ thờ Trà Kiệu nổi tiếng với những cảnh múa hát sống động. Mỹ Sơn là nơi hành lễ còn Trà Kiệu là trung tâm chính trị, hai nơi bổ sung cho nhau trong đời sống của vương quốc.'),
(N'MS34', N'vi', N'Hội An và con đường giao thương', N'Chăm Pa là một cường quốc đi biển, thương cảng Hội An xưa là cửa ngõ đưa hàng hóa như trầm hương, gốm và tơ lụa ra khắp châu Á.',
 N'Chăm Pa là một cường quốc đi biển, thương cảng Hội An xưa là cửa ngõ đưa hàng hóa như trầm hương, gốm và tơ lụa ra khắp châu Á. Cũng trong ngày bốn tháng mười hai năm một nghìn chín trăm chín mươi chín, phố cổ Hội An và thánh địa Mỹ Sơn cùng được UNESCO ghi danh. Hai di sản bổ sung cho nhau: một nơi kể về thần linh và vương quyền, một nơi kể về thương mại và đời sống thường nhật.'),
(N'MS35', N'vi', N'Rừng xanh và suối Khe Thẻ', N'Xung quanh các nhóm tháp là rừng thứ sinh với nhiều cây gỗ, dây leo và các loài chim nhỏ.',
 N'Xung quanh các nhóm tháp là rừng thứ sinh với nhiều cây gỗ, dây leo và các loài chim nhỏ. Rễ cây len vào kẽ gạch là một mối đe dọa đối với tháp cổ, vì vậy việc phát quang và theo dõi cây cối là công việc thường xuyên của đội bảo tồn. Hãy giữ gìn vệ sinh, không xả rác và không bẻ cành hái hoa để cùng bảo vệ cảnh quan chung.'),
(N'MS36', N'vi', N'Lưu ý khi tham quan', N'Mỹ Sơn là nơi thiêng liêng, xin du khách đi đúng lối mòn, không trèo lên tháp hay chạm vào các hoa văn trang trí.',
 N'Mỹ Sơn là nơi thiêng liêng, xin du khách đi đúng lối mòn, không trèo lên tháp hay chạm vào các hoa văn trang trí. Hãy mang theo nước uống, đội mũ và dùng kem chống nắng vì thung lũng khá nóng vào buổi trưa. Thời gian đẹp để tham quan là sáng sớm hoặc chiều muộn, khi ánh nắng chiếu xiên làm nổi bật màu đỏ của gạch. Bạn nên đeo tai nghe để không làm phiền người khác khi nghe thuyết minh.'),
(N'MS37', N'vi', N'Vì sao tháp quay mặt về hướng đông', N'Hầu hết các tháp Chăm mở cửa về hướng đông, hướng mặt trời mọc, vì tin rằng đó là hướng của các vị thần.',
 N'Hầu hết các tháp Chăm mở cửa về hướng đông, hướng mặt trời mọc, vì tin rằng đó là hướng của các vị thần. Tháp chỉ có một lối vào thật, các mặt còn lại làm cửa giả để trang trí. Khi đứng trước tháp lúc bình minh, bạn có thể cảm nhận vì sao người Chăm chọn hướng này.'),
(N'MS38', N'vi', N'Nghi lễ trong đền tháp xưa', N'Trong các buổi lễ xưa, tu sĩ Bà la môn thực hiện nghi thức tắm tượng thần, dâng hương, hoa quả và đọc kinh bằng tiếng Phạn.',
 N'Trong các buổi lễ xưa, tu sĩ Bà la môn thực hiện nghi thức tắm tượng thần, dâng hương, hoa quả và đọc kinh bằng tiếng Phạn. Vua và hoàng tộc thường tham dự trong các dịp trọng đại như lễ đăng quang hay lễ cầu mùa. Vì gian thờ trong tháp rất nhỏ nên nghi lễ chính diễn ra trong không gian kín, còn tín đồ đứng ngoài sân, tham dự qua tiếng nhạc và hương trầm.'),
(N'MS39', N'vi', N'Giá trị nổi bật được UNESCO ghi nhận', N'Mỹ Sơn được UNESCO ghi danh theo hai tiêu chí.',
 N'Mỹ Sơn được UNESCO ghi danh theo hai tiêu chí. Thứ nhất, nơi đây là minh chứng cho sự giao lưu văn hóa giữa Đông Nam Á bản địa và Ấn Độ. Thứ hai, đây là chứng tích đặc biệt của nền văn minh Chăm Pa từng hưng thịnh ở miền Trung Việt Nam. Hiểu điều này, chúng ta sẽ thấy mỗi viên gạch ở đây đều là một phần của ký ức nhân loại.'),
(N'MS40', N'vi', N'Lời cảm ơn và hẹn gặp lại', N'Hành trình khám phá Mỹ Sơn đến đây là kết thúc.',
 N'Hành trình khám phá Mỹ Sơn đến đây là kết thúc. Cảm ơn bạn đã lắng nghe những câu chuyện về một nền văn minh đã đi xa nhưng vẫn để lại dấu ấn sâu đậm. Mong bạn mang theo những hình ảnh đẹp của thánh địa, kể lại cho bạn bè và cùng chung tay gìn giữ di sản. Hẹn gặp lại bạn ở Mỹ Sơn lần sau!');

/* ----- English ----- */
INSERT INTO #T VALUES
(N'MS01', N'en', N'Introducing My Son Sanctuary', N'My Son Sanctuary lies in a secluded valley ringed by mountains, in the Duy Xuyen area of Quang Nam, now part of Da Nang city.',
 N'My Son Sanctuary lies in a secluded valley ringed by mountains, in the Duy Xuyen area of Quang Nam, now part of Da Nang city. From the 4th to the 13th century, the kings of Champa built dozens of temple towers here to honor the god Shiva and the royal ancestors. In 1999, UNESCO inscribed My Son as a World Cultural Heritage site. Join us as we explore one of the most important religious centers of the Champa kingdom.'),
(N'MS02', N'en', N'King Bhadravarman and the first temple', N'According to surviving inscriptions, in the late 4th century King Bhadravarman had a temple to the god Bhadreshvara built in this valley, laying the foundation of the sanctuary.',
 N'According to surviving inscriptions, in the late 4th century King Bhadravarman had a temple to the god Bhadreshvara built in this valley, laying the foundation of the sanctuary. The original temple was made of wood and was destroyed by fire. Later kings rebuilt and expanded it in brick, turning My Son into a place of worship for successive dynasties over more than nine centuries.'),
(N'MS03', N'en', N'Group A and Tower A1', N'Group A once held the main tower A1, about 24 meters tall, regarded as the most magnificent building at My Son.',
 N'Group A once held the main tower A1, about 24 meters tall, regarded as the most magnificent building at My Son. In 1969, during the war, bombs destroyed tower A1 and many nearby structures almost completely. Today the remaining brickwork reminds us why protecting heritage matters.'),
(N'MS04', N'en', N'Group B – the temple of Bhadreshvara', N'Group B includes the main tower B1, called the Kalan, regarded as the spiritual heart of the complex, where the linga of the god Bhadreshvara was worshipped.',
 N'Group B includes the main tower B1, called the Kalan, regarded as the spiritual heart of the complex, where the linga of the god Bhadreshvara was worshipped. The Kalan has a square plan with its door facing east, and a small dark sanctum inside that symbolizes a sacred mountain cave. The smaller surrounding towers honored guardian deities and stored offerings.'),
(N'MS05', N'en', N'Group C and Tower C1', N'Group C is known for tower C1, one of the best preserved structures at My Son, dating to around the 8th century.',
 N'Group C is known for tower C1, one of the best preserved structures at My Son, dating to around the 8th century. Researchers believe it was dedicated to Shiva, the supreme god of the ancient Cham. Look closely at the decorative motifs on the pilasters and door arches, which show remarkable brick-carving skill.'),
(N'MS06', N'en', N'Group D – a gallery of Cham sculpture', N'Buildings D1 and D2 are now used to display sandstone sculptures found at My Son, such as statues of deities, lingas, altar pedestals and bas-reliefs.',
 N'Buildings D1 and D2 are now used to display sandstone sculptures found at My Son, such as statues of deities, lingas, altar pedestals and bas-reliefs. Here visitors can look closely at the evolution of Cham art across several historical periods.'),
(N'MS07', N'en', N'Groups E and F and the My Son E1 style', N'The My Son E1 style, from about the 7th to the 8th century, is named after tower E1 and is considered one of the earliest and finest periods of Cham art.',
 N'The My Son E1 style, from about the 7th to the 8th century, is named after tower E1 and is considered one of the earliest and finest periods of Cham art. It is famous for altar pedestals carved in relief with lively figures, animals and foliage. Many important pieces from this group are now preserved in Cham sculpture museums.'),
(N'MS08', N'en', N'Group G', N'Group G is a cluster of towers from around the 12th century, with a massive main tower G1 whose roof tiers diminish toward the top.',
 N'Group G is a cluster of towers from around the 12th century, with a massive main tower G1 whose roof tiers diminish toward the top. It reflects late-period Cham architecture, when the kingdom was still building and renewing the sanctuary.'),
(N'MS09', N'en', N'Group H', N'Group H is a smaller cluster of towers in the valley.',
 N'Group H is a smaller cluster of towers in the valley. Groups like this show that the sanctuary grew continuously across many reigns, each leaving its own mark in building technique and decorative style.'),
(N'MS10', N'en', N'Group K', N'Group K consists of small towers on the edge of the sanctuary.',
 N'Group K consists of small towers on the edge of the sanctuary. Although not as imposing as the central groups, they complete the picture of how the Cham organized sacred space, with every cluster serving its own role.'),
(N'MS11', N'en', N'The mystery of Cham bricks', N'The Cham built their towers from fired brick, set so tightly that mortar joints are almost invisible.',
 N'The Cham built their towers from fired brick, set so tightly that mortar joints are almost invisible. Researchers still disagree about the binding material; one theory suggests a tree resin mixed with clay. Carving the decoration directly into the finished tower walls is another hallmark of Cham architecture.'),
(N'MS12', N'en', N'Apsara dance and Cham culture', N'Apsaras are celestial dancers from Indian mythology and appear often on Cham reliefs.',
 N'Apsaras are celestial dancers from Indian mythology and appear often on Cham reliefs. At My Son, visitors can often enjoy Cham dance performances with traditional costumes and instruments such as the Ginang drum and the Saranai oboe, evoking the festive atmosphere of long ago.'),
(N'MS13', N'en', N'Conservation and World Heritage', N'Since the 1980s, experts from Vietnam and abroad, including the Polish architect Kazimierz Kwiatkowski, have studied and restored My Son.',
 N'Since the 1980s, experts from Vietnam and abroad, including the Polish architect Kazimierz Kwiatkowski, have studied and restored My Son. In 1999 UNESCO inscribed it on the World Heritage List for its outstanding evidence of cultural exchange and as testimony to a vanished civilization.'),
(N'MS14', N'en', N'The 1898 discovery of My Son', N'In 1898, the French engineer Camille Paris rediscovered the temple complex, then covered by forest.',
 N'In 1898, the French engineer Camille Paris rediscovered the temple complex, then covered by forest. Henri Parmentier and researchers of the French School of the Far East later surveyed it and labeled the tower clusters with letters to ease study. That lettering system is still used today.'),
(N'MS15', N'en', N'The sacred valley and Mount Mahaparvata', N'The My Son valley is about two kilometers wide, sheltered by low surrounding hills.',
 N'The My Son valley is about two kilometers wide, sheltered by low surrounding hills. To the west rises Cat''s Tooth Mountain, regarded by the ancient Cham as the sacred Mahaparvata, home of the gods. The Khe The stream flows through the valley, and in Hindu belief such water is tied to purification in rituals. This landscape is why Cham kings chose it for their sanctuary.'),
(N'MS16', N'en', N'The kingdom of Champa', N'Champa was a kingdom that took shape at the end of the 2nd century and stretched along what is now central Vietnam.',
 N'Champa was a kingdom that took shape at the end of the 2nd century and stretched along what is now central Vietnam. Its important centers included Simhapura near Tra Kieu, Indrapura at Dong Duong and Vijaya in Binh Dinh. Its people lived by farming, fishing and maritime trade, absorbed Indian culture and created a distinctive art of their own. My Son was the religious center tied to the dynasties of this kingdom.'),
(N'MS17', N'en', N'Shiva, linga and yoni', N'Most temples at My Son honor Shiva, one of the three principal gods of Hinduism.',
 N'Most temples at My Son honor Shiva, one of the three principal gods of Hinduism. He is often shown as a linga, a cylindrical stone pillar set on a yoni base representing the goddess. Together they symbolize creative power and the fertility of the universe. Kings often joined their own names to the god''s to glorify their line; Bhadreshvara, for instance, is Shiva linked to King Bhadravarman.'),
(N'MS18', N'en', N'Cham temple architecture', N'A Cham temple group typically has a main tower called the Kalan, a long hall for preparing offerings called the Mandapa, a storehouse called the Kosagrha, and a gateway tower called the Gopura.',
 N'A Cham temple group typically has a main tower called the Kalan, a long hall for preparing offerings called the Mandapa, a storehouse called the Kosagrha, and a gateway tower called the Gopura. The main tower is built as a miniature of Mount Meru, the center of the universe in Hindu thought. Its roof tiers shrink as they rise, each echoing the one below and giving a sense of reaching toward the sky.'),
(N'MS19', N'en', N'Traces of war and bomb craters', N'In 1969, bombing raids badly damaged many tower groups at My Son.',
 N'In 1969, bombing raids badly damaged many tower groups at My Son. Large bomb craters can still be seen within the site, a silent witness to the war. That loss drew professionals and the international community to care more about protecting heritage. Please keep quiet and stay on the visitor paths.'),
(N'MS20', N'en', N'The Mandapa – hall of the worshippers', N'The Mandapa is the hall in front of the main tower, where priests prepared offerings and worshippers gathered before the ceremony.',
 N'The Mandapa is the hall in front of the main tower, where priests prepared offerings and worshippers gathered before the ceremony. Its roof was usually tile and timber, so most has vanished, leaving foundations and rows of brick pillars. As you walk among these traces, imagine the lively festival days of old, with music, incense and processions bearing offerings.'),
(N'MS21', N'en', N'The sacred water', N'Inside the sanctum, ritual water was poured over the linga and flowed along a groove on the yoni base out through a stone spout called the somasutra.',
 N'Inside the sanctum, ritual water was poured over the linga and flowed along a groove on the yoni base out through a stone spout called the somasutra. This water was considered sacred, and worshippers could collect it for blessings. This small detail shows that Cham architecture was not just for viewing but bound to the living rituals of the people.'),
(N'MS22', N'en', N'Motifs of Kala, Makara and Garuda', N'On tower doorways and pilasters you will find many mythical figures.',
 N'On tower doorways and pilasters you will find many mythical figures. Kala is the fierce face guarding the top of a door, Makara is a water monster with an elephant-like head and fish body, and Garuda is the divine bird who carries the god Vishnu. Together with curling foliage and the serpent Naga, these motifs both decorate and protect the sacred place.'),
(N'MS23', N'en', N'The art of sandstone sculpture', N'Besides brick, the Cham used sandstone to carve statues of deities, altar pedestals and decorative elements.',
 N'Besides brick, the Cham used sandstone to carve statues of deities, altar pedestals and decorative elements. Cham sculpture developed through several styles including My Son E1, Hoa Lai, Dong Duong, Tra Kieu and Thap Mam. Each has its own character in body proportions, facial features and the rendering of clothing. Many outstanding works are displayed at the Museum of Cham Sculpture in Da Nang.'),
(N'MS24', N'en', N'The My Son E1 pedestal', N'The altar pedestal from tower E1 is a masterpiece of Cham sculpture, carved in relief with scenes of daily life and mythology.',
 N'The altar pedestal from tower E1 is a masterpiece of Cham sculpture, carved in relief with scenes of daily life and mythology. It shows seated ascetics, musicians and dancers among trees and animals. Researchers rate it very highly, and it is preserved at the Museum of Cham Sculpture in Da Nang.'),
(N'MS25', N'en', N'The Rishi ascetics', N'In many Cham reliefs you will see Rishi ascetics with long beards and high topknots, seated in meditation or prayer.',
 N'In many Cham reliefs you will see Rishi ascetics with long beards and high topknots, seated in meditation or prayer. Rishis are sages of the Indian tradition, symbolizing wisdom and austere practice. Their presence in the art shows how much the Cham valued spiritual life and purity.'),
(N'MS26', N'en', N'Group F', N'Group F consists of a few small structures, mostly in ruins, with only foundations and some brick walls remaining.',
 N'Group F consists of a few small structures, mostly in ruins, with only foundations and some brick walls remaining. Yet their position beside Group E shows that tower clusters were laid out close together as worship complexes. Even modest remains like these are valuable evidence for archaeologists studying the sanctuary''s layout.'),
(N'MS27', N'en', N'Tower G1', N'Tower G1 has a square body with shrinking roof tiers, and small decorative towers sit at each corner.',
 N'Tower G1 has a square body with shrinking roof tiers, and small decorative towers sit at each corner. Its outer walls are divided into flat panels, giving the tower a clear rhythm. It is a fine example of late Cham architecture, letting visitors compare it with tower C1 to see how form and decoration changed over about four centuries.'),
(N'MS28', N'en', N'The path around the valley', N'Walking along the valley, you will see tower groups scattered among the greenery, each with its own character.',
 N'Walking along the valley, you will see tower groups scattered among the greenery, each with its own character. The small towers rising from the forest canopy bring a sense of calm, true to the spirit of an ancient place of devotion. Take a few quiet minutes to look and to listen to the forest.'),
(N'MS29', N'en', N'Cham steles and inscriptions', N'At My Son and other Cham sites, the ancients left many steles inscribed in Sanskrit and Old Cham.',
 N'At My Son and other Cham sites, the ancients left many steles inscribed in Sanskrit and Old Cham. The inscriptions record kings donating land, servants and wealth to temples and praise the merits of reigning kings. Thanks to these lines, historians can reconstruct many milestones of the kingdom, including King Bhadravarman founding a temple to the god.'),
(N'MS30', N'en', N'International cooperation in restoration', N'Many countries have taken part in conserving My Son.',
 N'Many countries have taken part in conserving My Son. Polish specialists worked here from the 1980s, followed by support from Italian organizations and experts and others, including India. Each restoration must be careful, limiting new materials so as to keep as much of the original value of the monuments as possible.'),
(N'MS31', N'en', N'The Kate festival and the Cham today', N'Today the Cham still live in central and south-central Vietnam, preserving their language, script and many distinctive customs.',
 N'Today the Cham still live in central and south-central Vietnam, preserving their language, script and many distinctive customs. The Kate festival is held each year at Cham towers to honor deities and heroic kings, with offerings, singing, dancing and processions in traditional dress. It shows that Cham culture is not only found in monuments but lives on in the community.'),
(N'MS32', N'en', N'Cham musical instruments', N'Music is inseparable from Cham festivals.',
 N'Music is inseparable from Cham festivals. The Ginang and Baranung drums set a strong rhythm, the Saranai oboe sings out its resonant melody, while gongs, hand drums and the Kanhi fiddle enrich the soundscape. Hearing these sounds at My Son, you are carried back to offering ceremonies in the temples centuries ago.'),
(N'MS33', N'en', N'Tra Kieu – the capital Simhapura', N'Not far from My Son lies Tra Kieu, believed to be the site of the capital Simhapura, meaning city of lions.',
 N'Not far from My Son lies Tra Kieu, believed to be the site of the capital Simhapura, meaning city of lions. Excavations there have yielded important artifacts such as the Tra Kieu altar pedestal, famous for lively dancing and music scenes. My Son was the place of worship while Tra Kieu was the political center, complementing each other in the life of the kingdom.'),
(N'MS34', N'en', N'Hoi An and the trade routes', N'Champa was a seafaring power, and the port of Hoi An served as a gateway sending goods such as agarwood, ceramics and silk across Asia.',
 N'Champa was a seafaring power, and the port of Hoi An served as a gateway sending goods such as agarwood, ceramics and silk across Asia. On the same day, the fourth of December 1999, UNESCO inscribed both Hoi An Ancient Town and My Son Sanctuary. The two heritage sites complement each other: one tells of gods and kingship, the other of trade and everyday life.'),
(N'MS35', N'en', N'The forest and the Khe The stream', N'The tower groups are surrounded by secondary forest with many trees, vines and small birds.',
 N'The tower groups are surrounded by secondary forest with many trees, vines and small birds. Tree roots creeping into brick joints threaten the ancient towers, so clearing and monitoring vegetation is routine work for the conservation team. Please keep the site clean, do not litter and do not break branches or pick flowers, so we protect the landscape together.'),
(N'MS36', N'en', N'Visitor tips', N'My Son is a sacred place; please stay on the paths, do not climb the towers or touch the decorative carvings.',
 N'My Son is a sacred place; please stay on the paths, do not climb the towers or touch the decorative carvings. Bring drinking water, wear a hat and use sunscreen as the valley can be hot at midday. The best times to visit are early morning or late afternoon, when slanting light brings out the red of the brick. Please use headphones so as not to disturb others while listening to the guide.'),
(N'MS37', N'en', N'Why the towers face east', N'Most Cham towers open to the east, the direction of the rising sun, which was believed to be the direction of the gods.',
 N'Most Cham towers open to the east, the direction of the rising sun, which was believed to be the direction of the gods. The towers have just one real doorway, while the other sides carry decorative false doors. Standing before a tower at dawn, you can sense why the Cham chose this orientation.'),
(N'MS38', N'en', N'Rituals in the ancient temples', N'In ancient ceremonies, Brahmin priests bathed the images of the gods, offered incense, fruit and flowers, and chanted in Sanskrit.',
 N'In ancient ceremonies, Brahmin priests bathed the images of the gods, offered incense, fruit and flowers, and chanted in Sanskrit. Kings and the royal family usually attended on great occasions such as coronations or harvest rites. Because the sanctum inside each tower is tiny, the central rite took place in a closed space, while worshippers stood in the courtyard, taking part through music and incense.'),
(N'MS39', N'en', N'Outstanding value recognized by UNESCO', N'UNESCO inscribed My Son under two criteria.',
 N'UNESCO inscribed My Son under two criteria. First, it shows the cultural exchange between indigenous Southeast Asia and India. Second, it is an exceptional testimony to the Champa civilization that once flourished in central Vietnam. Understanding this, we see that every brick here is part of humanity''s memory.'),
(N'MS40', N'en', N'Thank you and see you again', N'Our journey through My Son ends here.',
 N'Our journey through My Son ends here. Thank you for listening to the stories of a civilization that has long passed yet left a deep mark. We hope you take with you beautiful images of the sanctuary, share them with friends and join us in safeguarding this heritage. See you again at My Son!');

/* ----- 中文 ----- */
INSERT INTO #T VALUES
(N'MS01', N'zh', N'美山圣地简介', N'美山圣地坐落在群山环抱的幽静山谷中，位于广南省维川县一带，现属岘港市。',
 N'美山圣地坐落在群山环抱的幽静山谷中，位于广南省维川县一带，现属岘港市。从公元四世纪到十三世纪，占婆国王在此建造了数十座寺庙塔楼，用来供奉湿婆神并祭祀王室祖先。一九九九年，联合国教科文组织将美山列为世界文化遗产。让我们一同走进这个占婆王国最重要的宗教中心之一。'),
(N'MS02', N'zh', N'跋陀罗跋摩国王与第一座神庙', N'根据现存碑铭，四世纪末，跋陀罗跋摩国王在这个山谷中修建了供奉跋陀罗湿伐罗神的神庙，奠定了圣地的基础。',
 N'根据现存碑铭，四世纪末，跋陀罗跋摩国王在这个山谷中修建了供奉跋陀罗湿伐罗神的神庙，奠定了圣地的基础。最初的神庙是木结构，后来毁于大火。此后历代国王不断重建，改用砖石建造，使美山在九百多年间成为各个王朝举行祭典的圣地。'),
(N'MS03', N'zh', N'A组与A1塔', N'A组曾拥有主塔A1，高约二十四米，被认为是美山最宏伟、最美丽的建筑。',
 N'A组曾拥有主塔A1，高约二十四米，被认为是美山最宏伟、最美丽的建筑。一九六九年战争期间，炸弹几乎将A1塔及附近许多建筑彻底摧毁。如今残存的砖墙提醒我们守护遗产的意义。'),
(N'MS04', N'zh', N'B组——跋陀罗湿伐罗神庙', N'B组包括主塔B1，也称为卡兰塔，被视为整个神庙群的信仰中心，供奉跋陀罗湿伐罗神的林伽。',
 N'B组包括主塔B1，也称为卡兰塔，被视为整个神庙群的信仰中心，供奉跋陀罗湿伐罗神的林伽。卡兰塔平面为方形，门朝东开，内部是小而幽暗的圣室，象征神圣的山洞。周围的小塔用来供奉护法神灵和存放供品。'),
(N'MS05', N'zh', N'C组与C1塔', N'C组以C1塔闻名，它是美山保存最完好的建筑之一，年代约在八世纪。',
 N'C组以C1塔闻名，它是美山保存最完好的建筑之一，年代约在八世纪。研究者认为这里供奉的是湿婆神，也就是古代占婆人信仰中的至高神。请留意壁柱和门拱上的装饰图案，展现了精湛的砖雕工艺。'),
(N'MS06', N'zh', N'D组——占婆雕刻展厅', N'D1和D2两座建筑现用于陈列在美山发现的砂岩雕刻，如神像、林伽、祭坛基座和浮雕。',
 N'D1和D2两座建筑现用于陈列在美山发现的砂岩雕刻，如神像、林伽、祭坛基座和浮雕。在这里，游客可以近距离观察占婆艺术在不同历史时期的演变。'),
(N'MS07', N'zh', N'E、F组与美山E1风格', N'美山E1风格约在七至八世纪，因E1塔而得名，被认为是占婆艺术最早也是最精美的时期之一。',
 N'美山E1风格约在七至八世纪，因E1塔而得名，被认为是占婆艺术最早也是最精美的时期之一。其突出特点是浮雕祭坛基座，刻有生动的人物、动物和花草。这一组塔的许多重要文物现保存在占婆雕刻博物馆中。'),
(N'MS08', N'zh', N'G组', N'G组是约十二世纪的塔群，主塔G1雄伟高大，屋顶层层向上收缩。',
 N'G组是约十二世纪的塔群，主塔G1雄伟高大，屋顶层层向上收缩。它体现了占婆晚期建筑的特色，当时王国仍在继续建设和修缮圣地。'),
(N'MS09', N'zh', N'H组', N'H组是山谷中较小的塔群。',
 N'H组是山谷中较小的塔群。像H组这样的塔群说明圣地在历代王朝中不断扩建，每个时期都在建造技术和装饰风格上留下了自己的印记。'),
(N'MS10', N'zh', N'K组', N'K组由位于圣地边缘的小型塔楼组成。',
 N'K组由位于圣地边缘的小型塔楼组成。虽然不如中心塔群宏伟，但它们让我们更完整地了解占婆人如何布局神圣空间，每个塔群都有各自的作用。'),
(N'MS11', N'zh', N'占婆砖的奥秘', N'占婆人用烧制的砖建造塔楼，砖块拼合得十分紧密，几乎看不到灰缝。',
 N'占婆人用烧制的砖建造塔楼，砖块拼合得十分紧密，几乎看不到灰缝。至今研究者对所用的粘合材料仍无定论，有一种假说认为是树脂混合黏土。在建成的塔身上直接雕刻装饰，也是占婆建筑的一大特色。'),
(N'MS12', N'zh', N'阿普萨拉舞与占婆文化', N'阿普萨拉是印度神话中的天女舞者，常见于占婆浮雕。',
 N'阿普萨拉是印度神话中的天女舞者，常见于占婆浮雕。在美山，游客常常能欣赏到身着传统服饰、配以吉那昂鼓和萨拉奈唢呐的占婆舞蹈，仿佛重现昔日的节庆氛围。'),
(N'MS13', N'zh', N'保护与世界遗产', N'自二十世纪八十年代起，越南国内外许多专家，其中包括波兰建筑师卡齐米日·克维亚特科夫斯基，参与了美山的研究与修复。',
 N'自二十世纪八十年代起，越南国内外许多专家，其中包括波兰建筑师卡齐米日·克维亚特科夫斯基，参与了美山的研究与修复。一九九九年，联合国教科文组织因美山在文化交流方面的突出价值，以及作为一个消逝文明的见证，将其列入世界遗产名录。'),
(N'MS14', N'zh', N'一八九八年美山的发现', N'一八九八年，法国工程师卡米耶·巴里斯重新发现了被森林覆盖的塔群。',
 N'一八九八年，法国工程师卡米耶·巴里斯重新发现了被森林覆盖的塔群。随后，亨利·帕尔芒捷和法国远东学院的研究者进行了勘察，并用字母给各个塔群编号以便研究。这种字母编号方式沿用至今。'),
(N'MS15', N'zh', N'神圣山谷与摩诃波婆多山', N'美山山谷宽约两公里，四周被低矮的山丘环抱。',
 N'美山山谷宽约两公里，四周被低矮的山丘环抱。西侧耸立着猫牙山，古代占婆人视其为圣山摩诃波婆多，是诸神居住之地。克特溪穿过山谷，按照印度教的观念，这样的水与仪式中的净化相关联。正是这样的景观，使占婆国王选择此地作为圣地。'),
(N'MS16', N'zh', N'占婆王国', N'占婆王国形成于二世纪末，疆域沿今天的越南中部延伸。',
 N'占婆王国形成于二世纪末，疆域沿今天的越南中部延伸。重要的中心先后有茶峤附近的狮城、同阳的因陀罗补罗和平定的毗阇耶。居民以农业、捕鱼和海上贸易为生，吸收了印度文化，并创造出独具特色的艺术。美山就是与这个王国历代王朝相连的宗教中心。'),
(N'MS17', N'zh', N'湿婆神、林伽与约尼', N'美山的大多数寺庙供奉湿婆神，他是印度教三大主神之一。',
 N'美山的大多数寺庙供奉湿婆神，他是印度教三大主神之一。湿婆常以林伽的形式出现，那是一根圆柱形石柱，安放在象征女神的约尼底座上。二者结合，象征着宇宙的创造力与生生不息。国王们常把自己的名字与神名相结合以彰显王室血统，例如跋陀罗湿伐罗就是与跋陀罗跋摩王相关联的湿婆神。'),
(N'MS18', N'zh', N'占婆寺庙建筑', N'占婆寺庙群通常由几部分组成：主塔称为卡兰，用来准备祭品的长厅称为曼达帕，存放供品的仓库称为科萨格哈，门塔称为歌普拉。',
 N'占婆寺庙群通常由几部分组成：主塔称为卡兰，用来准备祭品的长厅称为曼达帕，存放供品的仓库称为科萨格哈，门塔称为歌普拉。主塔被建成须弥山的缩影，须弥山在印度教观念中是宇宙的中心。塔顶层层收缩，每一层都重复下一层的形状，给人向天空升腾之感。'),
(N'MS19', N'zh', N'战争的痕迹与弹坑', N'一九六九年，轰炸使美山的许多塔群遭到严重损毁。',
 N'一九六九年，轰炸使美山的许多塔群遭到严重损毁。遗址内至今仍可见到巨大的弹坑，默默见证着战争。正是这样的损失，促使专业人士和国际社会更加关注遗产保护。请游客保持安静，并沿着参观道路行走。'),
(N'MS20', N'zh', N'曼达帕——信众聚集的厅堂', N'曼达帕是主塔前方的厅堂，僧侣在此准备祭品，信众在仪式前聚集于此。',
 N'曼达帕是主塔前方的厅堂，僧侣在此准备祭品，信众在仪式前聚集于此。屋顶通常用瓦和木材建成，因此大部分已经消失，只留下地基和一排排砖柱。当您走在这些遗迹之间时，不妨想象昔日节日的热闹景象：乐声、香烟和捧着供品的队伍。'),
(N'MS21', N'zh', N'圣水', N'在圣室内，仪式用水被浇在林伽上，再沿着约尼底座的凹槽，通过一条名为苏摩苏特拉的石质水槽流出。',
 N'在圣室内，仪式用水被浇在林伽上，再沿着约尼底座的凹槽，通过一条名为苏摩苏特拉的石质水槽流出。这股水被视为圣水，信众可以接取以祈求福报。这个小小的细节说明，占婆建筑不仅供人观赏，更与古人鲜活的仪式紧密相连。'),
(N'MS22', N'zh', N'卡拉、摩羯与迦楼罗图案', N'在塔门和壁柱上，您会看到许多神话形象。',
 N'在塔门和壁柱上，您会看到许多神话形象。卡拉是守护门楣上方的凶猛兽面，摩羯是象头鱼身的水中神兽，迦楼罗则是毗湿奴神的坐骑神鸟。连同卷曲的花叶和那伽蛇神，这些图案既是装饰，也守护着神圣的场所。'),
(N'MS23', N'zh', N'砂岩雕刻艺术', N'除了砖，占婆人还用砂岩雕刻神像、祭坛基座和装饰构件。',
 N'除了砖，占婆人还用砂岩雕刻神像、祭坛基座和装饰构件。占婆雕刻艺术经历了美山E1、和莱、同阳、茶峤和塔茗等多种风格。每种风格在身体比例、面部特征和服饰表现上都各有特点。许多代表作品现陈列在岘港占婆雕刻博物馆。'),
(N'MS24', N'zh', N'美山E1祭坛基座', N'E1塔的祭坛基座是占婆雕刻的杰作，上面浮雕着许多生活与神话场景。',
 N'E1塔的祭坛基座是占婆雕刻的杰作，上面浮雕着许多生活与神话场景。画面中有打坐的苦行者、乐师和舞者，树木与动物穿插其间。研究者对它评价极高，现保存在岘港占婆雕刻博物馆。'),
(N'MS25', N'zh', N'仙人与苦修者', N'在许多占婆浮雕中，您会看到留着长须、头顶高髻、打坐或祈祷的仙人。',
 N'在许多占婆浮雕中，您会看到留着长须、头顶高髻、打坐或祈祷的仙人。仙人是印度传统中的圣贤，象征智慧与苦修。他们出现在艺术作品中，说明占婆人十分重视精神生活与清净。'),
(N'MS26', N'zh', N'F组', N'F组由几座小型建筑组成，大多已经倒塌，只剩下地基和几段砖墙。',
 N'F组由几座小型建筑组成，大多已经倒塌，只剩下地基和几段砖墙。不过，它们与E组相邻的位置表明，各个塔群是按照祭祀组合紧邻布置的。这样朴素的遗迹，也是考古学家研究圣地布局的宝贵资料。'),
(N'MS27', N'zh', N'G1塔', N'G1塔的塔身呈方形，屋顶层层收缩，每个角上都设有装饰性小塔。',
 N'G1塔的塔身呈方形，屋顶层层收缩，每个角上都设有装饰性小塔。外墙被划分为许多平整的壁面，使塔身具有清晰的节奏感。它是占婆晚期建筑的优美范例，游客可以与C1塔对比，看看四个世纪里造型与装饰的变化。'),
(N'MS28', N'zh', N'山谷周围的小路', N'沿着山谷漫步，您会看到塔群散布在绿树之间，各有各的风貌。',
 N'沿着山谷漫步，您会看到塔群散布在绿树之间，各有各的风貌。小塔从林冠中耸出，带来宁静之感，正合古代修行之地的气质。请花几分钟静静地观看，聆听森林的声音。'),
(N'MS29', N'zh', N'占婆碑铭', N'在美山和其他占婆遗址，古人留下了许多用梵文和古占文刻写的碑铭。',
 N'在美山和其他占婆遗址，古人留下了许多用梵文和古占文刻写的碑铭。碑文记录了国王向寺庙捐献土地、仆役和财物，并颂扬历代国王的功德。借助这些文字，历史学家得以重建王国的许多历史节点，其中就包括跋陀罗跋摩国王建庙敬神之事。'),
(N'MS30', N'zh', N'修复中的国际合作', N'许多国家参与了美山的保护工作。',
 N'许多国家参与了美山的保护工作。波兰专家自二十世纪八十年代起在此工作，随后得到意大利机构和专家以及包括印度在内的其他一些国家的支持。每一次修复都必须谨慎，尽量少用新材料，以最大限度保留遗迹的原有价值。'),
(N'MS31', N'zh', N'卡特节与今日的占族', N'如今，占族人仍生活在越南中部和南中部，保留着自己的语言、文字和许多独特习俗。',
 N'如今，占族人仍生活在越南中部和南中部，保留着自己的语言、文字和许多独特习俗。卡特节每年在占婆塔举行，以纪念神灵和英雄国王，有祭献、歌舞和身着传统服饰的游行。这说明占婆文化不只存在于遗迹之中，也依然活在族群当中。'),
(N'MS32', N'zh', N'占婆乐器', N'音乐是占婆节庆不可缺少的一部分。',
 N'音乐是占婆节庆不可缺少的一部分。吉那昂鼓和巴拉农鼓奏出强劲的节奏，萨拉奈唢呐吹出悠长的旋律，锣、手鼓和卡尼琴则丰富了声音的层次。在美山听到这些声音，仿佛回到几百年前神庙中的祭典。'),
(N'MS33', N'zh', N'茶峤——狮城都城', N'离美山不远的茶峤，被认为是都城狮城的所在地，意为“狮子之城”。',
 N'离美山不远的茶峤，被认为是都城狮城的所在地，意为“狮子之城”。那里的发掘出土了许多重要文物，如以生动歌舞场面闻名的茶峤祭坛。美山是祭祀之地，茶峤则是政治中心，两地在王国的生活中相辅相成。'),
(N'MS34', N'zh', N'会安与贸易之路', N'占婆是一个航海强国，会安港是将沉香、陶瓷和丝绸运往亚洲各地的门户。',
 N'占婆是一个航海强国，会安港是将沉香、陶瓷和丝绸运往亚洲各地的门户。一九九九年十二月四日，联合国教科文组织同时将会安古城和美山圣地列入世界遗产名录。这两处遗产相辅相成：一处讲述神灵与王权，另一处讲述贸易与日常生活。'),
(N'MS35', N'zh', N'森林与克特溪', N'塔群周围是次生林，生长着许多树木、藤蔓，还有小鸟。',
 N'塔群周围是次生林，生长着许多树木、藤蔓，还有小鸟。树根钻进砖缝对古塔构成威胁，因此清理和监测植被是保护队的日常工作。请保持环境整洁，不乱扔垃圾，不折枝摘花，共同保护这片景观。'),
(N'MS36', N'zh', N'参观提示', N'美山是神圣之地，请游客沿着步道行走，不要攀爬塔楼，也不要触摸装饰雕刻。',
 N'美山是神圣之地，请游客沿着步道行走，不要攀爬塔楼，也不要触摸装饰雕刻。请携带饮用水，戴帽子并涂防晒霜，因为山谷中午相当炎热。最佳参观时间是清晨或傍晚，斜射的阳光会让砖块的红色格外突出。聆听讲解时请戴上耳机，以免打扰他人。'),
(N'MS37', N'zh', N'为什么塔门朝东', N'大多数占婆塔的门朝东，也就是日出的方向，人们相信那是神明所在的方向。',
 N'大多数占婆塔的门朝东，也就是日出的方向，人们相信那是神明所在的方向。塔只有一个真正的入口，其余各面都是装饰性的假门。黎明时分站在塔前，您就能体会占婆人为何选择这个朝向。'),
(N'MS38', N'zh', N'古代神庙中的仪式', N'在古代的仪式中，婆罗门祭司为神像沐浴，献上香、水果和鲜花，并用梵语诵经。',
 N'在古代的仪式中，婆罗门祭司为神像沐浴，献上香、水果和鲜花，并用梵语诵经。国王和王室成员通常在加冕礼或祈丰收等重大场合出席。由于塔内圣室狭小，核心仪式在封闭空间中进行，信众则站在庭院里，通过音乐和香烟参与其中。'),
(N'MS39', N'zh', N'联合国教科文组织认定的突出价值', N'联合国教科文组织依据两项标准将美山列入名录。',
 N'联合国教科文组织依据两项标准将美山列入名录。第一，它展示了东南亚本土文化与印度文化之间的交流。第二，它是曾在越南中部繁荣一时的占婆文明的特殊见证。明白这一点，我们就会发现这里的每一块砖都是人类记忆的一部分。'),
(N'MS40', N'zh', N'感谢与再会', N'美山的探索之旅到此结束。',
 N'美山的探索之旅到此结束。感谢您聆听这个已经远去、却留下深深印记的文明的故事。愿您带走圣地的美好印象，讲给朋友听，并与我们一起守护这份遗产。期待在美山再次与您相会！');

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
