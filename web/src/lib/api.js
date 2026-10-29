const BASE = import.meta.env.VITE_API_URL || '';

const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } },
};
export const storage = ls;
export const KEYS = { visitor: 'ms_ticket', admin: 'ms_admin', lang: 'ms_lang' };

export class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export const assetUrl = (u) => (!u ? null : /^https?:/.test(u) ? u : BASE + u);

async function request(path, { method = 'GET', body, auth, blob } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth === 'admin' ? ls.get(KEYS.admin) : auth === 'visitor' ? ls.get(KEYS.visitor) : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(BASE + '/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ');
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new ApiError(res.status, j.message || `Lỗi ${res.status}`, j.code);
  }
  return blob ? res.blob() : res.json();
}

const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

/* Khách */
export const api = {
  settings: () => request('/settings'),
  languages: () => request('/languages'),
  zones: (lang) => request('/zones' + qs({ lang })),
  stories: (params) => request('/stories' + qs(params)),
  story: (ref, lang) => request(`/stories/${ref}` + qs({ lang }), { auth: 'visitor' }),
  listen: (id, body) => request(`/stories/${id}/listen`, { method: 'POST', body, auth: 'visitor' }).catch(() => null),
  activate: (code, lang) => request('/tickets/activate', { method: 'POST', body: { code, lang } }),
  myTicket: () => request('/tickets/me', { auth: 'visitor' }),
};

/* Quản trị */
const A = (path, opt = {}) => request('/admin' + path, { auth: 'admin', ...opt });
export const admin = {
  login: (username, password) => request('/admin/auth/login', { method: 'POST', body: { username, password } }),
  me: () => A('/auth/me'),
  changePassword: (body) => A('/auth/change-password', { method: 'POST', body }),
  dashboard: () => A('/dashboard'),
  languages: () => A('/languages'),
  updateLanguage: (id, body) => A(`/languages/${id}`, { method: 'PUT', body }),
  zones: () => A('/zones'),
  saveZone: (z) => (z.zoneId ? A(`/zones/${z.zoneId}`, { method: 'PUT', body: z }) : A('/zones', { method: 'POST', body: z })),
  deleteZone: (id) => A(`/zones/${id}`, { method: 'DELETE' }),
  stories: (params) => A('/stories' + qs(params)),
  story: (id) => A(`/stories/${id}`),
  saveStory: (id, body) => (id ? A(`/stories/${id}`, { method: 'PUT', body }) : A('/stories', { method: 'POST', body })),
  publishStory: (id, isPublished) => A(`/stories/${id}/publish`, { method: 'PATCH', body: { isPublished } }),
  deleteStory: (id) => A(`/stories/${id}`, { method: 'DELETE' }),
  upload: async (kind, file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BASE}/api/admin/upload?kind=${kind}`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${ls.get(KEYS.admin)}` } });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, j.message || 'Tải file thất bại');
    return j.url;
  },
  ticketTypes: () => A('/ticket-types'),
  saveTicketType: (t) => (t.ticketTypeId ? A(`/ticket-types/${t.ticketTypeId}`, { method: 'PUT', body: t }) : A('/ticket-types', { method: 'POST', body: t })),
  tickets: (params) => A('/tickets' + qs(params)),
  ticketBatches: () => A('/ticket-batches'),
  generateTickets: (body) => A('/tickets/generate', { method: 'POST', body }),
  revokeTicket: (id) => A(`/tickets/${id}/revoke`, { method: 'POST' }),
  exportTickets: (params) => A('/tickets/export' + qs(params), { blob: true }),
  users: () => A('/users'),
  saveUser: (u) => (u.id ? A(`/users/${u.id}`, { method: 'PUT', body: u }) : A('/users', { method: 'POST', body: u })),
  resetPassword: (id, newPassword) => A(`/users/${id}/reset-password`, { method: 'POST', body: { newPassword } }),
  settings: () => A('/settings'),
  saveSettings: (body) => A('/settings', { method: 'PUT', body }),
  auditLogs: (params) => A('/audit-logs' + qs(params)),
};
