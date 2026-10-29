const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const { badRequest } = require('../utils/httpError');

const KINDS = {
  image: { dir: 'images', max: 8 * 1024 * 1024, types: { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' } },
  audio: { dir: 'audio', max: 40 * 1024 * 1024, types: { 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/ogg': '.ogg', 'audio/aac': '.aac' } },
};

/** Nhận 1 file ở field "file"; loại file lấy từ ?kind=image|audio. Tên file do server tự sinh. */
function uploadSingle(req, res, next) {
  const kind = KINDS[req.query.kind];
  if (!kind) return next(badRequest('kind phải là image hoặc audio'));
  const dir = path.join(config.uploadDir, kind.dir);
  fs.mkdirSync(dir, { recursive: true });
  const upload = multer({
    limits: { fileSize: kind.max, files: 1 },
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + kind.types[file.mimetype]),
    }),
    fileFilter: (_req, file, cb) => (kind.types[file.mimetype] ? cb(null, true) : cb(badRequest('Định dạng file không được hỗ trợ'))),
  }).single('file');
  upload(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) return next(badRequest('Chưa chọn file'));
    req.uploadedUrl = `/uploads/${kind.dir}/${req.file.filename}`;
    next();
  });
}

module.exports = { uploadSingle };
