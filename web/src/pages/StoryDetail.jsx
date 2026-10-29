import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { LANGS } from '../lib/i18n';
import { useAsync, useI18n, useTicket } from '../lib/state';
import { Cover, ErrorBox, Spinner } from '../components/Common';
import Player from '../components/Player';

export default function StoryDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { t, lang, setLang, locale } = useI18n();
  const { ticket, clear } = useTicket();
  const { data: s, loading, error } = useAsync(() => api.story(id, lang), [id, lang, ticket?.code]);
  const list = useAsync(() => api.stories({ lang }), [lang]);

  // Token hết hạn/bị thu hồi: xóa vé để khách nhập lại
  useEffect(() => { if (error?.status === 401 || error?.status === 410) clear(); }, [error, clear]);

  if (loading && !s) return <Spinner label={t('loading')} />;
  if (error) return <><ErrorBox error={error} /><Link to="/stories" className="btn">{t('back')}</Link></>;

  const idx = list.data?.findIndex((x) => x.id === s.id) ?? -1;
  const prev = idx > 0 ? list.data[idx - 1] : null;
  const next = idx >= 0 && idx < list.data.length - 1 ? list.data[idx + 1] : null;
  const listen = () => api.listen(s.id, { lang: s.contentLang, source: 'web', mode: params.get('auto') ? 'auto' : 'manual' });

  return (
    <article className="detail">
      <Link to="/stories" className="muted small">← {t('back')}</Link>
      <Cover story={s} className="hero-cover" />
      <div className="row between wrapflex">
        <div className="muted">#{s.order} · {s.zone.name}</div>
        <div className="lang-switch">
          {LANGS.filter((l) => s.languages.includes(l.code) || l.code === lang).map((l) => (
            <button key={l.code} className={l.code === lang ? 'on' : ''} onClick={() => setLang(l.code)}>{l.short}</button>
          ))}
        </div>
      </div>
      <h1>{s.title}</h1>
      {s.contentLang !== lang && <div className="alert">{t('story.fallback')}</div>}

      {s.locked ? (
        <div className="card lock-card">
          <p>{s.summary}</p>
          <p><strong>🔒 {t('story.unlock')}</strong></p>
          <Link className="btn primary lg" to={`/code?next=${encodeURIComponent(`/stories/${s.id}`)}`}>{t('hero.cta')}</Link>
        </div>
      ) : (
        <>
          <Player story={s} locale={LANGS.find((l) => l.code === s.contentLang)?.locale || locale} autoStart={!!params.get('auto')} onFirstPlay={listen} />
          <p className="content">{s.content}</p>
        </>
      )}

      <div className="row between">
        {prev ? <button className="btn" onClick={() => nav(`/stories/${prev.id}`)}>← {t('story.prev')}</button> : <span />}
        {next ? <button className="btn" onClick={() => nav(`/stories/${next.id}`)}>{t('story.next')} →</button> : <span />}
      </div>
    </article>
  );
}
