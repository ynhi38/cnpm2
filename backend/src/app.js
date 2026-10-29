const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);   // chạy sau nginx/reverse proxy: lấy đúng IP khách cho rate limit

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));   // cho phép web/app khác origin tải ảnh, audio
app.use(cors({
  origin(origin, cb) {
    // Cho phép app mobile / curl (không có Origin) và các origin cấu hình
    if (!origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) return cb(null, true);
    cb(new Error('Origin không được phép'));
  },
}));
if (!config.isProd) app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', index: false }));
app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
