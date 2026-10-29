const stats = require('../repositories/statsRepository');
const ticketService = require('./ticketService');

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

exports.dashboard = async () => {
  const days = 14;
  const [totals, byDay, top, byLanguage, bySource, missing, tickets] = await Promise.all([
    stats.totals(), stats.listensByDay(days), stats.topStories(8), stats.byLanguage(), stats.bySource(),
    stats.missingTranslations(), ticketService.countByStatus(),
  ]);
  const map = new Map(byDay.map((r) => [isoDay(r.ListenDate), r.Listens]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    series.push({ date: d, listens: map.get(d) || 0 });
  }
  return {
    totals, tickets, listensByDay: series, topStories: top, byLanguage, bySource,
    missingTranslations: missing,
  };
};
