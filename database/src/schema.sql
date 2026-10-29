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
