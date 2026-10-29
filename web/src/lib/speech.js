import { useCallback, useEffect, useRef, useState } from 'react';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Chia văn bản thành các đoạn ngắn (Chrome tự dừng khi đoạn quá dài). */
export function chunkText(text, max = 170) {
  const sentences = String(text).replace(/\s+/g, ' ').match(/[^.!?。！？;；]+[.!?。！？;；]?/g) || [text];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > max && cur) { out.push(cur.trim()); cur = ''; }
    if (s.length > max) {
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim());
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

function pickVoice(locale) {
  const voices = window.speechSynthesis.getVoices();
  const prefix = locale.slice(0, 2).toLowerCase();
  const exact = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === locale.toLowerCase());
  const loose = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  return [...exact, ...loose][0] || null;
}

/** Đọc văn bản bằng Web Speech API: play / pause / resume / stop, chọn tốc độ. */
export function useSpeech(text, locale) {
  const [status, setStatus] = useState('idle');   // idle | playing | paused
  const [rate, setRate] = useState(1);
  const [noVoice, setNoVoice] = useState(false);
  const run = useRef(0);   // token để huỷ phiên đọc cũ

  const stop = useCallback(() => {
    run.current++;
    if (supported) window.speechSynthesis.cancel();
    setStatus('idle');
  }, []);

  const play = useCallback(() => {
    if (!supported || !text) return;
    window.speechSynthesis.cancel();
    const id = ++run.current;
    const chunks = chunkText(text);
    const voice = pickVoice(locale);
    setNoVoice(!voice);
    let i = 0;
    const next = () => {
      if (id !== run.current) return;
      if (i >= chunks.length) { setStatus('idle'); return; }
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      u.lang = locale;
      u.rate = rate;
      if (voice) u.voice = voice;
      u.onend = next;
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') setStatus('idle'); };
      window.speechSynthesis.speak(u);
    };
    setStatus('playing');
    next();
  }, [text, locale, rate]);

  const pause = useCallback(() => { if (supported) { window.speechSynthesis.pause(); setStatus('paused'); } }, []);
  const resume = useCallback(() => { if (supported) { window.speechSynthesis.resume(); setStatus('playing'); } }, []);

  // Dừng khi đổi nội dung/ngôn ngữ hoặc rời trang
  useEffect(() => stop, [text, locale, stop]);
  // Một số trình duyệt nạp danh sách giọng bất đồng bộ
  useEffect(() => {
    if (!supported) return undefined;
    const h = () => {};
    window.speechSynthesis.addEventListener('voiceschanged', h);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', h);
  }, []);

  return { supported, status, rate, setRate, noVoice, play, pause, resume, stop };
}
