import { Link } from 'react-router-dom';
import { useI18n, useTicket, useAsync } from '../lib/state';
import { api } from '../lib/api';

export default function Home() {
  const { t } = useI18n();
  const { ticket } = useTicket();
  const { data: settings } = useAsync(() => api.settings().catch(() => ({})), []);
  const feats = ['stories', 'lang', 'sense', 'easy'];
  return (
    <>
      <section className="hero">
        <div className="kicker">{t('hero.kicker')}</div>
        <h1>{t('hero.title').split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</h1>
        <p>{t('hero.sub')}</p>
        <div className="row gap wrapflex">
          <Link className="btn primary lg" to={ticket ? '/stories' : '/code'}>{ticket ? t('nav.stories') : t('hero.cta')}</Link>
          {!ticket && <Link className="btn ghost lg" to="/stories">{t('hero.browse')}</Link>}
        </div>
      </section>

      <section className="grid4">
        {feats.map((f) => (
          <div className="card feat" key={f}><h3>{t(`feat.${f}`)}</h3><p>{t(`feat.${f}.d`)}</p></div>
        ))}
      </section>

      <section className="card steps">
        <h2>{t('steps.title')}</h2>
        <ol>{[1, 2, 3].map((n) => <li key={n}><span className="num">{n}</span>{t(`steps.${n}`)}</li>)}</ol>
        {settings?.['site.address'] && <p className="muted small">📍 {settings['site.address']}</p>}
      </section>
    </>
  );
}
