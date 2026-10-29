import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, admin, storage, KEYS } from './api';
import { LANGS, t as tr } from './i18n';

/* ---------- Ngôn ngữ giao diện + nội dung ---------- */
const I18n = createContext(null);
export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = storage.get(KEYS.lang);
    if (LANGS.some((l) => l.code === saved)) return saved;
    const nav = (navigator.language || 'vi').slice(0, 2);
    return LANGS.some((l) => l.code === nav) ? nav : 'vi';
  });
  const setLang = useCallback((c) => { setLangState(c); storage.set(KEYS.lang, c); document.documentElement.lang = c; }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: (k) => tr(k, lang), locale: LANGS.find((l) => l.code === lang).locale }), [lang, setLang]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);

/* ---------- Vé của khách ---------- */
const Ticket = createContext(null);
export function TicketProvider({ children }) {
  const [ticket, setTicket] = useState(null);   // { code, typeName, expiresAt }
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!storage.get(KEYS.visitor)) { setTicket(null); setReady(true); return; }
    try {
      const me = await api.myTicket();
      setTicket(me);
    } catch {
      storage.del(KEYS.visitor);
      setTicket(null);
    }
    setReady(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const activate = useCallback(async (code, lang) => {
    const r = await api.activate(code, lang);
    storage.set(KEYS.visitor, r.token);
    setTicket({ ...r.ticket, expiresAt: r.expiresAt, secondsLeft: r.secondsLeft });
    return r;
  }, []);
  const clear = useCallback(() => { storage.del(KEYS.visitor); setTicket(null); }, []);

  return <Ticket.Provider value={{ ticket, ready, activate, clear, refresh }}>{children}</Ticket.Provider>;
}
export const useTicket = () => useContext(Ticket);

/* ---------- Quản trị ---------- */
const Auth = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!storage.get(KEYS.admin)) { setReady(true); return; }
    admin.me().then(setUser).catch(() => storage.del(KEYS.admin)).finally(() => setReady(true));
  }, []);

  const login = useCallback(async (username, password) => {
    const r = await admin.login(username, password);
    storage.set(KEYS.admin, r.token);
    setUser(r.user);
  }, []);
  const logout = useCallback(() => { storage.del(KEYS.admin); setUser(null); }, []);
  return <Auth.Provider value={{ user, ready, login, logout }}>{children}</Auth.Provider>;
}
export const useAuth = () => useContext(Auth);

/* ---------- Tải dữ liệu đơn giản ---------- */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((x) => x + 1) };
}
