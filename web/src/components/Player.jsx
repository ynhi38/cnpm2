import { useEffect, useRef } from 'react';
import { assetUrl } from '../lib/api';
import { useSpeech } from '../lib/speech';
import { useI18n } from '../lib/state';

/** Trình phát: dùng file âm thanh thu sẵn nếu có, ngược lại đọc tự động bằng TTS của thiết bị. */
export default function Player({ story, locale, autoStart, onFirstPlay }) {
  const { t } = useI18n();
  const sp = useSpeech(story.content, locale);
  const audioRef = useRef(null);
  const logged = useRef(false);
  const hasFile = !!story.audioUrl;

  const first = () => { if (!logged.current) { logged.current = true; onFirstPlay?.(); } };

  useEffect(() => { logged.current = false; }, [story.id, locale]);
  useEffect(() => {
    if (!autoStart) return;
    if (hasFile) audioRef.current?.play().then(first).catch(() => {});
    else if (sp.supported) { sp.play(); first(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, story.id, story.content]);

  if (hasFile) {
    return (
      <div className="player">
        <audio ref={audioRef} controls preload="none" src={assetUrl(story.audioUrl)} onPlay={first} style={{ width: '100%' }} />
      </div>
    );
  }
  if (!sp.supported) return <div className="alert">{t('player.nottts')}</div>;

  return (
    <div className="player">
      <div className="row gap">
        {sp.status === 'idle' && <button className="btn primary" onClick={() => { sp.play(); first(); }}>▶ {t('player.play')}</button>}
        {sp.status === 'playing' && <button className="btn primary" onClick={sp.pause}>❚❚ {t('player.pause')}</button>}
        {sp.status === 'paused' && <button className="btn primary" onClick={sp.resume}>▶ {t('player.resume')}</button>}
        <button className="btn" onClick={sp.stop} disabled={sp.status === 'idle'}>■ {t('player.stop')}</button>
        <label className="row gap small">
          {t('player.speed')}
          <select value={sp.rate} onChange={(e) => sp.setRate(Number(e.target.value))}>
            {[0.75, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        </label>
      </div>
      <div className="muted small">{t('player.tts')} ({locale})</div>
      {sp.noVoice && <div className="alert">{t('player.novoice')}</div>}
    </div>
  );
}
