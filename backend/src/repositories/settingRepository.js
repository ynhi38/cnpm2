const { query, p } = require('../config/db');

exports.all = async () => Object.fromEntries((await query('SELECT SettingKey, SettingValue FROM dbo.AppSettings')).map((r) => [r.SettingKey, r.SettingValue]));

exports.set = (key, value) =>
  query(
    `MERGE dbo.AppSettings AS d USING (SELECT @k AS SettingKey) AS s ON d.SettingKey = s.SettingKey
     WHEN MATCHED THEN UPDATE SET SettingValue = @v, UpdatedAt = SYSUTCDATETIME()
     WHEN NOT MATCHED THEN INSERT (SettingKey, SettingValue) VALUES (@k, @v);`,
    { k: p.str(key, 50), v: p.str(value, 500) },
  );
