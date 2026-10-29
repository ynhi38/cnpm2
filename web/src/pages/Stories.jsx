import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync, useI18n, useTicket } from '../lib/state';
import { Cover, ErrorBox, Spinner } from '../components/Common';

export default function Stories() {
  const { t, lang } = useI18n();
  const { ticket } = useTicket();
  const [zone, setZone] = useState('');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(id); }, [q]);

  const zones = useAsync(() => api.zones(lang), [lang]);
  const stories = useAsync(() => api.stories({ lang, zone, q: debounced }), [lang, zone, debounced]);

  return (
    <>
      <h1>{t('stories.title')}</h1>
      <div className="toolbar">
        <input type="search" placeholder={t('stories.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button className={!zone ? 'on' : ''} onClick={() => setZone('')}>{t('stories.all')}</button>
          {zones.data?.map((z) => <button key={z.zoneId} className={String(z.zoneId) === String(zone) ? 'on' : ''} onClick={() => setZone(z.zoneId)}>{z.name}</button>)}
        </div>
      </div>
      {stories.loading && <Spinner label={t('loading')} />}
      {stories.error && <ErrorBox error={stories.error} />}
      {stories.data && !stories.data.length && <p className="muted">{t('stories.empty')}</p>}
      <div className="grid">
        {stories.data?.map((s) => (
          <Link to={`/stories/${s.id}`} className="card story" key={s.id}>
            <Cover story={s} />
            <div className="body">
              <div className="row between small muted">
                <span>#{s.order} · {s.zone.name}</span>
                {s.isPreview ? <span className="tag free">{t('story.free')}</span> : !ticket && <span className="tag lock">🔒 {t('story.locked')}</span>}
              </div>
              <h3>{s.title}</h3>
              <p>{s.summary}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
