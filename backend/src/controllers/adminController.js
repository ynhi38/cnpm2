const { wrap, badRequest } = require('../utils/httpError');
const v = require('../utils/validate');
const authService = require('../services/authService');
const userService = require('../services/userService');
const languageService = require('../services/languageService');
const zoneService = require('../services/zoneService');
const storyService = require('../services/storyService');
const ticketService = require('../services/ticketService');
const statsService = require('../services/statsService');
const settingService = require('../services/settingService');
const auditRepository = require('../repositories/auditRepository');

const body = (req) => req.body || {};
const id = (req) => v.int(req.params.id, { name: 'Id', required: true, min: 1 });

// --- Tài khoản đăng nhập ---
exports.login = wrap(async (req, res) => res.json(await authService.login(body(req))));
exports.me = wrap(async (req, res) => res.json(await authService.me(req.user.id)));
exports.changePassword = wrap(async (req, res) => { await authService.changePassword(req.user.id, body(req)); res.status(204).end(); });

// --- Tổng quan ---
exports.dashboard = wrap(async (_req, res) => res.json(await statsService.dashboard()));

// --- Ngôn ngữ ---
exports.languages = wrap(async (_req, res) => res.json(await languageService.listAdmin()));
exports.updateLanguage = wrap(async (req, res) => res.json(await languageService.update(id(req), body(req), req.user)));

// --- Khu ---
exports.zones = wrap(async (_req, res) => res.json(await zoneService.listAdmin()));
exports.createZone = wrap(async (req, res) => res.status(201).json(await zoneService.create(body(req), req.user)));
exports.updateZone = wrap(async (req, res) => res.json(await zoneService.update(id(req), body(req), req.user)));
exports.deleteZone = wrap(async (req, res) => { await zoneService.remove(id(req), req.user); res.status(204).end(); });

// --- Câu chuyện ---
exports.stories = wrap(async (req, res) => res.json(await storyService.listAdmin(req.query)));
exports.story = wrap(async (req, res) => res.json(await storyService.getAdmin(id(req))));
exports.createStory = wrap(async (req, res) => res.status(201).json(await storyService.create(body(req), req.user)));
exports.updateStory = wrap(async (req, res) => res.json(await storyService.update(id(req), body(req), req.user)));
exports.publishStory = wrap(async (req, res) => { await storyService.setPublished(id(req), body(req).isPublished, req.user); res.status(204).end(); });
exports.deleteStory = wrap(async (req, res) => { await storyService.remove(id(req), req.user); res.status(204).end(); });

// --- Tải file ---
exports.upload = wrap(async (req, res) => {
  if (!req.uploadedUrl) throw badRequest('Tải file thất bại');
  res.status(201).json({ url: req.uploadedUrl, size: req.file.size });
});

// --- Vé ---
exports.ticketTypes = wrap(async (_req, res) => res.json(await ticketService.listTypes()));
exports.createTicketType = wrap(async (req, res) => res.status(201).json(await ticketService.createType(body(req), req.user)));
exports.updateTicketType = wrap(async (req, res) => res.json(await ticketService.updateType(id(req), body(req), req.user)));
exports.tickets = wrap(async (req, res) => res.json(await ticketService.list(req.query)));
exports.ticketBatches = wrap(async (_req, res) => res.json(await ticketService.listBatches()));
exports.generateTickets = wrap(async (req, res) => res.status(201).json(await ticketService.generate(body(req), req.user)));
exports.revokeTicket = wrap(async (req, res) => { await ticketService.revoke(id(req), req.user); res.status(204).end(); });
exports.exportTickets = wrap(async (req, res) => {
  const csv = await ticketService.exportCsv(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tickets.csv"');
  res.send(csv);
});

// --- Người dùng (Admin) ---
exports.users = wrap(async (_req, res) => res.json(await userService.list()));
exports.createUser = wrap(async (req, res) => res.status(201).json(await userService.create(body(req), req.user)));
exports.updateUser = wrap(async (req, res) => res.json(await userService.update(id(req), body(req), req.user)));
exports.resetUserPassword = wrap(async (req, res) => { await userService.resetPassword(id(req), body(req), req.user); res.status(204).end(); });

// --- Cấu hình & nhật ký (Admin) ---
exports.settings = wrap(async (_req, res) => res.json(await settingService.get()));
exports.updateSettings = wrap(async (req, res) => res.json(await settingService.update(body(req), req.user)));
exports.auditLogs = wrap(async (req, res) => {
  const pg = v.paging(req.query, { defaultSize: 50 });
  res.json({ ...(await auditRepository.list(pg)), page: pg.page, pageSize: pg.pageSize });
});
