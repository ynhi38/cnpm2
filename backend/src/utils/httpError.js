class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    if (code) this.code = code;   // mã máy đọc được, ví dụ TICKET_REQUIRED
  }
}

const badRequest = (m) => new HttpError(400, m);
const unauthorized = (m = 'Chưa đăng nhập') => new HttpError(401, m);
const forbidden = (m = 'Không đủ quyền') => new HttpError(403, m);
const notFound = (m = 'Không tìm thấy dữ liệu') => new HttpError(404, m);
const conflict = (m) => new HttpError(409, m);
const gone = (m, code) => new HttpError(410, m, code);

/** Bọc controller async để lỗi chuyển sang middleware xử lý lỗi. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, gone, wrap };
