import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
import { useGeofence } from '../lib/geo';
import { useAsync, useI18n } from '../lib/state';
import { ErrorBox, Spinner } from '../components/Common';

function SchematicMap({ stories, zones, onPick, active }) {
  return (
    <div className="schematic">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 60 C 20 50, 30 75, 50 68 S 85 40, 100 52" className="river" />
      </svg>
      {zones.map((z) => z.mapX != null && <span key={z.code} className="zone-label" style={{ left: `${z.mapX}%`, top: `${z.mapY}%` }}>{z.code}</span>)}
      {stories.filter((s) => s.mapX != null).map((s) => (
        <button key={s.id} className={`pin ${active === s.id ? 'on' : ''}`} style={{ left: `${s.mapX}%`, top: `${s.mapY}%` }} onClick={() => onPick(s)} title={s.title}>{s.order}</button>
      ))}
    </div>
  );
}

function RealMap({ stories, pos, onPick }) {
  const el = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);
  const me = useRef(null);

  useEffect(() => {
    map.current = L.map(el.current).setView([15.764, 108.124], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);

  useEffect(() => {
    markers.current.clearLayers();
    const pts = [];
    stories.filter((s) => s.latitude != null).forEach((s) => {
      const ll = [Number(s.latitude), Number(s.longitude)];
      pts.push(ll);
      L.marker(ll, { icon: L.divIcon({ className: 'pin-div', html: `<b>${s.order}</b>`, iconSize: [26, 26] }) })
        .on('click', () => onPick(s)).addTo(markers.current);
    });
    if (pts.length) map.current.fitBounds(pts, { padding: [30, 30], maxZoom: 18 });
  }, [stories, onPick]);

  useEffect(() => {
    if (!pos) return;
    if (!me.current) me.current = L.circleMarker([pos.lat, pos.lng], { radius: 8, color: '#1b6ef3', fillOpacity: 0.9 }).addTo(map.current);
    else me.current.setLatLng([pos.lat, pos.lng]);
  }, [pos]);

  return <div ref={el} className="realmap" />;
}

export default function MapPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [view, setView] = useState('schematic');
  const [auto, setAuto] = useState(false);
  const [picked, setPicked] = useState(null);
  const stories = useAsync(() => api.stories({ lang }), [lang]);
  const zones = useAsync(() => api.zones(lang), [lang]);

  const { pos, error } = useGeofence(stories.data, auto, (s) => nav(`/stories/${s.id}?auto=1`));
  useEffect(() => { setPicked(null); }, [lang]);

  // Tâm khu để vẽ nhãn trên sơ đồ: trung bình vị trí các câu chuyện trong khu
  const zoneLabels = (zones.data || []).map((z) => {
    const ss = (stories.data || []).filter((s) => s.zone.id === z.zoneId && s.mapX != null);
    if (!ss.length) return { code: z.code };
    return { code: z.code, mapX: ss.reduce((a, s) => a + Number(s.mapX), 0) / ss.length, mapY: ss.reduce((a, s) => a + Number(s.mapY), 0) / ss.length - 7 };
  });

  return (
    <>
      <h1>{t('map.title')}</h1>
      <div className="row between wrapflex toolbar">
        <div className="lang-switch">
          <button className={view === 'schematic' ? 'on' : ''} onClick={() => setView('schematic')}>{t('map.schematic')}</button>
          <button className={view === 'real' ? 'on' : ''} onClick={() => setView('real')}>{t('map.real')}</button>
        </div>
        <label className="switch"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> {t('map.auto')}</label>
      </div>
      {auto && !error && <div className="alert ok">{t('map.autoOn')}</div>}
      {error && <div className="alert error">{t('map.denied')}</div>}
      {stories.loading && <Spinner label={t('loading')} />}
      {stories.error && <ErrorBox error={stories.error} />}
      {stories.data && (view === 'schematic'
        ? <SchematicMap stories={stories.data} zones={zoneLabels} onPick={setPicked} active={picked?.id} />
        : <RealMap stories={stories.data} pos={pos} onPick={setPicked} />)}
      <p className="muted small">{t('map.note')}</p>
      {picked && (
        <div className="card picked">
          <div className="muted small">#{picked.order} · {picked.zone.name}</div>
          <h3>{picked.title}</h3>
          <p>{picked.summary}</p>
          <Link className="btn primary" to={`/stories/${picked.id}`}>{t('player.play')}</Link>
        </div>
      )}
    </>
  );
}
