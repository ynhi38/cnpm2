const express = require('express');
const rateLimit = require('express-rate-limit');
const { optionalVisitor, requireVisitor, requireAdmin, requireRole } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const pub = require('../controllers/publicController');
const adm = require('../controllers/adminController');

const limiter = (windowMs, max, message) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { message } });

const router = express.Router();

/* ===================== PUBLIC (khách) ===================== */
router.get('/health', pub.health);
router.get('/settings', pub.settings);
router.get('/languages', pub.languages);
router.get('/zones', pub.zones);
router.get('/stories', pub.stories);
router.get('/stories/:ref', optionalVisitor, pub.story);
router.post('/stories/:id/listen', limiter(60 * 1000, 120, 'Quá nhiều yêu cầu'), optionalVisitor, pub.listen);
router.post('/tickets/activate', limiter(15 * 60 * 1000, 20, 'Nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút'), pub.activateTicket);
router.get('/tickets/me', requireVisitor, pub.myTicket);

/* ===================== ADMIN ===================== */
const admin = express.Router();
admin.post('/auth/login', limiter(15 * 60 * 1000, 20, 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút'), adm.login);

admin.use(requireAdmin);
const adminOnly = requireRole('Admin');

admin.get('/auth/me', adm.me);
admin.post('/auth/change-password', adm.changePassword);
admin.get('/dashboard', adm.dashboard);

admin.get('/languages', adm.languages);
admin.put('/languages/:id', adminOnly, adm.updateLanguage);

admin.get('/zones', adm.zones);
admin.post('/zones', adm.createZone);
admin.put('/zones/:id', adm.updateZone);
admin.delete('/zones/:id', adminOnly, adm.deleteZone);

admin.get('/stories', adm.stories);
admin.get('/stories/:id', adm.story);
admin.post('/stories', adm.createStory);
admin.put('/stories/:id', adm.updateStory);
admin.patch('/stories/:id/publish', adm.publishStory);
admin.delete('/stories/:id', adminOnly, adm.deleteStory);

admin.post('/upload', uploadSingle, adm.upload);

admin.get('/ticket-types', adm.ticketTypes);
admin.post('/ticket-types', adminOnly, adm.createTicketType);
admin.put('/ticket-types/:id', adminOnly, adm.updateTicketType);
admin.get('/tickets', adm.tickets);
admin.get('/tickets/export', adm.exportTickets);
admin.get('/ticket-batches', adm.ticketBatches);
admin.post('/tickets/generate', adm.generateTickets);
admin.post('/tickets/:id/revoke', adm.revokeTicket);

admin.get('/users', adminOnly, adm.users);
admin.post('/users', adminOnly, adm.createUser);
admin.put('/users/:id', adminOnly, adm.updateUser);
admin.post('/users/:id/reset-password', adminOnly, adm.resetUserPassword);

admin.get('/settings', adm.settings);
admin.put('/settings', adminOnly, adm.updateSettings);
admin.get('/audit-logs', adminOnly, adm.auditLogs);

router.use('/admin', admin);
module.exports = router;
