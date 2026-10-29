import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, loadToken, setToken } from './api';
import { tr } from './i18n';
import { LANGS } from './config';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [lang, setLangState] = useState('vi');
  const [ticket, setTicket] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('ms_lang');
      if (LANGS.some((l) => l.code === saved)) setLangState(saved);
      if (await loadToken()) { try { setTicket(await api.myTicket()); } catch { await setToken(null); } }
      setReady(true);
    })();
  }, []);

  const setLang = useCallback((c) => { setLangState(c); AsyncStorage.setItem('ms_lang', c); }, []);
  const activate = useCallback(async (code) => {
    const r = await api.activate(code, lang);
    await setToken(r.token);
    setTicket({ ...r.ticket, expiresAt: r.expiresAt });
  }, [lang]);
  const clear = useCallback(async () => { await setToken(null); setTicket(null); }, []);

  const value = useMemo(() => ({
    lang, setLang, ticket, ready, activate, clear,
    locale: LANGS.find((l) => l.code === lang).locale, t: (k) => tr(k, lang),
  }), [lang, ticket, ready, setLang, activate, clear]);
  return <Ctx.Provider value={value}>{ready ? children : null}</Ctx.Provider>;
}
