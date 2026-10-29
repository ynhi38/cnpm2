function notFoundHandler(req, res) {
  res.status(404).json({ message: `Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Lỗi ràng buộc SQL Server: 2627/2601 = trùng khóa, 547 = vướng khóa ngoại
  if (err.number === 2627 || err.number === 2601) {
    return res.status(409).json({ message: 'Dữ liệu bị trùng (mã/tên đã tồn tại)' });
  }
  if (err.number === 547) {
    return res.status(409).json({ message: 'Không thể thực hiện: dữ liệu đang được sử dụng ở nơi khác' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Dữ liệu JSON không hợp lệ' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File quá lớn' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Lỗi máy chủ' : err.message, ...(err.code && status < 500 ? { code: err.code } : {}) });
}

module.exports = { notFoundHandler, errorHandler };
