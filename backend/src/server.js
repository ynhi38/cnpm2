require('dotenv').config();
const config = require('./config');
const app = require('./app');
const { getPool } = require('./config/db');

if (config.isProd && /change-me/.test(`${process.env.JWT_SECRET}${process.env.VISITOR_JWT_SECRET}`)) {
  console.error('Từ chối khởi động: hãy đặt JWT_SECRET và VISITOR_JWT_SECRET ngẫu nhiên trong môi trường production.');
  process.exit(1);
}

const server = app.listen(config.port, () => {
  console.log(`API Mỹ Sơn Audio Guide chạy tại http://localhost:${config.port}/api`);
  getPool().then(() => console.log('Đã kết nối SQL Server')).catch((e) => console.error('Chưa kết nối được SQL Server:', e.message));
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
