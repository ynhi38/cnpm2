const repo = require('../repositories/settingRepository');
const v = require('../utils/validate');
const audit = require('./audit');

const KEYS = ['site.name', 'site.address', 'site.hours', 'site.ticketHint'];

exports.get = () => repo.all();

exports.update = async (body, user) => {
  for (const key of KEYS) {
    if (body[key] === undefined) continue;
    await repo.set(key, v.str(body[key], { name: key, required: true, max: 500 }));
  }
  audit(user, 'UPDATE', 'Settings', null);
  return repo.all();
};
