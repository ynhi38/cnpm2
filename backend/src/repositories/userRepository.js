const { query, run, p } = require('../config/db');

const COLS = 'UserId, Username, FullName, Email, Role, IsActive, CreatedAt, LastLoginAt';

exports.list = () => query(`SELECT ${COLS} FROM dbo.Users ORDER BY UserId`);
exports.findById = async (id) => (await query(`SELECT ${COLS} FROM dbo.Users WHERE UserId=@id`, { id: p.int(id) }))[0];
exports.findForLogin = async (username) =>
  (await query(`SELECT ${COLS}, PasswordHash FROM dbo.Users WHERE Username=@u`, { u: p.str(username, 50) }))[0];
exports.findHash = async (id) => (await query('SELECT PasswordHash FROM dbo.Users WHERE UserId=@id', { id: p.int(id) }))[0]?.PasswordHash;

exports.create = async ({ username, passwordHash, fullName, email, role }) =>
  (await query(
    `INSERT INTO dbo.Users (Username, PasswordHash, FullName, Email, Role) OUTPUT INSERTED.UserId
     VALUES (@username, @hash, @fullName, @email, @role)`,
    { username: p.str(username, 50), hash: p.str(passwordHash, 200), fullName: p.str(fullName, 100), email: p.str(email, 150), role: p.str(role, 20) },
  ))[0].UserId;

exports.update = async (id, { fullName, email, role, isActive }) =>
  (await run('UPDATE dbo.Users SET FullName=@fullName, Email=@email, Role=@role, IsActive=@active WHERE UserId=@id',
    { id: p.int(id), fullName: p.str(fullName, 100), email: p.str(email, 150), role: p.str(role, 20), active: p.bit(isActive) })).rowsAffected[0] > 0;

exports.setPassword = (id, hash) => query('UPDATE dbo.Users SET PasswordHash=@h WHERE UserId=@id', { id: p.int(id), h: p.str(hash, 200) });
exports.touchLogin = (id) => query('UPDATE dbo.Users SET LastLoginAt=SYSUTCDATETIME() WHERE UserId=@id', { id: p.int(id) });
exports.countActiveAdmins = async () => (await query("SELECT COUNT(*) AS n FROM dbo.Users WHERE Role=N'Admin' AND IsActive=1"))[0].n;
