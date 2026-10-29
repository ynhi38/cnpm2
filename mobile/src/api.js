import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export const assetUrl = (u) => (!u ? null : /^https?:/.test(u) ? u : API_URL + u);

let token = null;
export const loadToken = async () => { token = await AsyncStorage.getItem('ms_ticket'); return token; };
export const setToken = async (t) => { token = t; if (t) await AsyncStorage.setItem('ms_ticket', t); else await AsyncStorage.removeItem('ms_ticket'); };

async function request(path, { method = 'GET', body, auth } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let res;
  try { res = await fetch(API_URL + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new ApiError(0, 'Không kết nối được máy chủ / Cannot reach server'); }
  if (res.status === 204) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.message || `Lỗi ${res.status}`, j.code);
  return j;
}
const qs = (o) => { const s = Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'); return s ? `?${s}` : ''; };

export const api = {
  zones: (lang) => request('/zones' + qs({ lang })),
  stories: (p) => request('/stories' + qs(p)),
  story: (ref, lang) => request(`/stories/${ref}` + qs({ lang }), { auth: true }),
  listen: (id, body) => request(`/stories/${id}/listen`, { method: 'POST', body: { ...body, source: 'mobile' }, auth: true }).catch(() => null),
  activate: (code, lang) => request('/tickets/activate', { method: 'POST', body: { code, lang } }),
  myTicket: () => request('/tickets/me', { auth: true }),
};
