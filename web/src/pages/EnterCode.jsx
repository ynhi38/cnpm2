import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n, useTicket } from '../lib/state';

function remaining(expiresAt, locale) {
  const ms = new Date(expiresAt) - Date.now();
  if (!(ms > 0)) return '';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return locale.startsWith('vi') ? `${h} giờ ${m} phút` : locale.startsWith('zh') ? `${h}小时${m}分钟` : `${h}h ${m}m`;
}

export default function EnterCode() {
  const { t, lang, locale } = useI18n();
  const { ticket, activate, clear } = useTicket();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await activate(code, lang); nav(params.get('next') || '/stories'); }
    catch (ex) { setErr(ex.message); }
    setBusy(false);
  };

  return (
    <div className="narrow">
      <h1>{t('code.title')}</h1>
      {ticket && (
        <div className="alert ok">
          <strong>{t('code.active')}:</strong> {ticket.code} — {t('code.ok')} {remaining(ticket.expiresAt, locale)}
          <div><button className="btn small" onClick={clear}>{t('code.clear')}</button></div>
        </div>
      )}
      <form className="card" onSubmit={submit}>
        <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MS-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" required />
        <div className="muted small">{t('code.hint')}</div>
        {err && <div className="alert error">{err}</div>}
        <button className="btn primary lg" disabled={busy || !code.trim()}>{t('code.submit')}</button>
      </form>
    </div>
  );
}
