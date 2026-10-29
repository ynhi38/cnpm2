import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LANGS } from '../lib/i18n';
import { useI18n, useTicket } from '../lib/state';
import { assetUrl } from '../lib/api';

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.code} className={l.code === lang ? 'on' : ''} onClick={() => setLang(l.code)} title={l.label}>{l.short}</button>
      ))}
    </div>
  );
}

export const Spinner = ({ label }) => <div className="center muted"><span className="spin" /> {label}</div>;
export const ErrorBox = ({ error }) => <div className="alert error">{error?.message || 'Error'}</div>;

export function PublicLayout() {
  const { t } = useI18n();
  const { ticket } = useTicket();
  return (
    <>
      <header className="site-header">
        <div className="wrap row between">
          <Link to="/" className="brand"><span className="logo">▲</span><span>{t('brand')}</span></Link>
          <nav className="nav">
            <NavLink to="/" end>{t('nav.home')}</NavLink>
            <NavLink to="/stories">{t('nav.stories')}</NavLink>
            <NavLink to="/map">{t('nav.map')}</NavLink>
            <NavLink to="/code" className={ticket ? 'ok' : ''}>{ticket ? '✓ ' : ''}{t('nav.code')}</NavLink>
          </nav>
          <LangSwitch />
        </div>
      </header>
      <main className="wrap page"><Outlet /></main>
      <footer className="site-footer"><div className="wrap row between"><span>{t('footer.rights')} · Mỹ Sơn</span><Link to="/admin" className="muted">Admin</Link></div></footer>
    </>
  );
}

/** Ảnh câu chuyện; nếu chưa có ảnh thì dùng nền hoa văn theo mã. */
export function Cover({ story, className = '' }) {
  const hue = 28 + ((story.id * 13) % 30);
  const style = story.imageUrl ? { backgroundImage: `url(${assetUrl(story.imageUrl)})` } : { background: `linear-gradient(135deg, hsl(${hue} 55% 38%), hsl(${hue - 12} 45% 24%))` };
  return <div className={`cover ${className}`} style={style}>{!story.imageUrl && <span className="cover-code">{story.code}</span>}</div>;
}

export function useGo() { const n = useNavigate(); return n; }
