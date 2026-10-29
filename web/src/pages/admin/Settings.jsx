import { useEffect, useState } from 'react';
import { admin } from '../../lib/api';
import { useAsync, useAuth } from '../../lib/state';
import { Spinner } from '../../components/Common';
import { Field } from './ui';

const KEYS = [['site.name', 'Tên hiển thị'], ['site.address', 'Địa chỉ'], ['site.hours', 'Giờ mở cửa'], ['site.ticketHint', 'Hướng dẫn mua vé']];

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user.role === 'Admin';
  const langs = useAsync(() => admin.languages(), []);
  const settings = useAsync(() => admin.settings(), []);
  const [form, setForm] = useState({});
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);

  const saveSettings = async (e) => { e.preventDefault(); try { await admin.saveSettings(form); alert('Đã lưu'); } catch (ex) { alert(ex.message); } };
  const patchLang = async (l, patch) => {
    try { await admin.updateLanguage(l.LanguageId, { nativeName: l.NativeName, ttsLocale: l.TtsLocale, isActive: !!l.IsActive, sortOrder: l.SortOrder, ...patch }); langs.reload(); } catch (ex) { alert(ex.message); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try { await admin.changePassword(pw); setPw({ currentPassword: '', newPassword: '' }); alert('Đã đổi mật khẩu'); } catch (ex) { alert(ex.message); }
  };

  return (
    <>
      <h1>Cấu hình</h1>
      <div className="card">
        <h3>Ngôn ngữ thuyết minh</h3>
        {langs.loading ? <Spinner label="Đang tải…" /> : (
          <table><thead><tr><th>Mã</th><th>Tên</th><th>Locale giọng đọc (TTS)</th><th>Bật</th></tr></thead>
            <tbody>{langs.data?.map((l) => (
              <tr key={l.LanguageId}><td>{l.Code}</td><td>{l.NativeName}</td>
                <td>{isAdmin ? <input defaultValue={l.TtsLocale} onBlur={(e) => e.target.value !== l.TtsLocale && patchLang(l, { ttsLocale: e.target.value })} /> : l.TtsLocale}</td>
                <td><input type="checkbox" disabled={!isAdmin || l.Code === 'vi'} checked={!!l.IsActive} onChange={(e) => patchLang(l, { isActive: e.target.checked })} /></td></tr>
            ))}</tbody></table>
        )}
        <p className="muted small">Đồ án hỗ trợ 3 ngôn ngữ: Việt – Anh – Trung. Tiếng Việt là ngôn ngữ gốc và không thể tắt.</p>
      </div>

      <form className="card" onSubmit={saveSettings}>
        <h3>Thông tin hiển thị trên website</h3>
        <div className="form-grid">{KEYS.map(([k, label]) => <Field key={k} label={label}><input value={form[k] || ''} disabled={!isAdmin} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>)}</div>
        {isAdmin && <button className="btn primary">Lưu</button>}
      </form>

      <form className="card narrow-card" onSubmit={changePw}>
        <h3>Đổi mật khẩu của tôi</h3>
        <Field label="Mật khẩu hiện tại"><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required autoComplete="current-password" /></Field>
        <Field label="Mật khẩu mới" hint="≥ 8 ký tự, gồm chữ và số"><input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required autoComplete="new-password" /></Field>
        <button className="btn primary">Đổi mật khẩu</button>
      </form>
    </>
  );
}
