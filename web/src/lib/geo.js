import { useEffect, useRef, useState } from 'react';

export function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Theo dõi GPS; khi vào bán kính của câu chuyện (chưa phát trong 10 phút) thì gọi onEnter(story). */
export function useGeofence(stories, enabled, onEnter) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState(null);
  const seen = useRef(new Map());
  const cb = useRef(onEnter);
  cb.current = onEnter;
  const list = useRef(stories);
  list.current = stories;

  useEffect(() => {
    if (!enabled) return undefined;
    if (!navigator.geolocation) { setError('unsupported'); return undefined; }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude, longitude } = p.coords;
        setPos({ lat: latitude, lng: longitude, accuracy: p.coords.accuracy });
        setError(null);
        let best = null;
        for (const s of list.current || []) {
          if (s.latitude == null) continue;
          const d = distanceM(latitude, longitude, Number(s.latitude), Number(s.longitude));
          if (d <= (s.triggerRadiusM || 30) && (!best || d < best.d)) best = { s, d };
        }
        if (best) {
          const last = seen.current.get(best.s.id) || 0;
          if (Date.now() - last > 10 * 60 * 1000) { seen.current.set(best.s.id, Date.now()); cb.current(best.s); }
        }
      },
      (e) => setError(e.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { pos, error };
}
