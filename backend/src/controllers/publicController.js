const { wrap } = require('../utils/httpError');
const { query } = require('../config/db');
const languageService = require('../services/languageService');
const zoneService = require('../services/zoneService');
const storyService = require('../services/storyService');
const ticketService = require('../services/ticketService');
const settingService = require('../services/settingService');

exports.health = wrap(async (_req, res) => {
  await query('SELECT 1 AS ok');
  res.json({ status: 'ok', time: new Date().toISOString() });
});
exports.settings = wrap(async (_req, res) => res.json(await settingService.get()));
exports.languages = wrap(async (_req, res) => {
  const rows = await languageService.listPublic();
  res.json(rows.map((l) => ({ code: l.Code, name: l.Name, nativeName: l.NativeName, ttsLocale: l.TtsLocale })));
});
exports.zones = wrap(async (req, res) => res.json(await zoneService.listPublic(req.query.lang)));
exports.stories = wrap(async (req, res) => res.json(await storyService.listPublic(req.query)));
exports.story = wrap(async (req, res) =>
  res.json(await storyService.getDetail(req.params.ref, req.query, { visitor: req.visitor, user: req.user })));
exports.listen = wrap(async (req, res) => {
  await storyService.logListen(req.params.id, req.body || {}, { visitor: req.visitor });
  res.status(204).end();
});
exports.activateTicket = wrap(async (req, res) => res.json(await ticketService.activate(req.body?.code, req.body?.lang)));
exports.myTicket = wrap(async (req, res) => res.json(await ticketService.me(req.visitor.ticketId)));
