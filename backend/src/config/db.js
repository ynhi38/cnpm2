const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME || 'MySonAudioGuide',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

/** Tham số có kiểu rõ ràng (tránh suy luận sai kiểu với NULL / số thập phân): p.int(5), p.str('a'), p.dec(15.76)... */
const p = {
  int: (value) => ({ __t: sql.Int, value }),
  bigint: (value) => ({ __t: sql.BigInt, value }),
  str: (value, len = sql.MAX) => ({ __t: sql.NVarChar(len), value }),
  bit: (value) => ({ __t: sql.Bit, value }),
  dec: (value) => ({ __t: sql.Decimal(9, 6), value }),
  dec2: (value) => ({ __t: sql.Decimal(5, 2), value }),
  dt: (value) => ({ __t: sql.DateTime2(0), value }),
};

/** Chạy câu lệnh với tham số dạng object { name: value | p.xxx(value) }; trả về { recordset, rowsAffected }. */
async function run(text, params = {}, tx = null) {
  const pool = await getPool();
  const request = tx ? new sql.Request(tx) : pool.request();
  for (const [key, value] of Object.entries(params)) {
    if (value && value.__t) request.input(key, value.__t, value.value);
    else request.input(key, value);
  }
  const result = await request.query(text);
  return { recordset: result.recordset || [], rowsAffected: result.rowsAffected || [] };
}

/** Chạy câu lệnh và trả về recordset. */
async function query(text, params = {}, tx = null) {
  return (await run(text, params, tx)).recordset;
}

async function transaction(work) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const out = await work(tx);
    await tx.commit();
    return out;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

module.exports = { sql, getPool, query, run, p, transaction };
