const path = require('path');

const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);

module.exports = {
  port: num(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080').split(',').map((s) => s.trim()).filter(Boolean),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')),
  isProd: process.env.NODE_ENV === 'production',
  /** Ngôn ngữ hỗ trợ (đồ án giới hạn Việt - Anh - Trung) */
  languages: ['vi', 'en', 'zh'],
  defaultLanguage: 'vi',
};
