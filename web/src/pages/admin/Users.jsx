import { useState } from 'react';
import { admin } from '../../lib/api';
import { useAsync, useAuth } from '../../lib/state';
import { ErrorBox, Spinner } from '../../components/Common';
import { Field, Modal, fmtDate } from './ui';

export default function Users() {
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useAsync(() => admin.users(), []);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');

  const save = async (e) => {
    e.preventDefault(); setErr('');
    try { await admin.saveUser(edit); setEdit(null); reload(); } catch (ex) { setErr(ex.message); }
  };
  const reset = async (u) => {
    const pw = prompt(`Mật khẩu mới cho ${u.username} (≥ 8 ký tự, gồm chữ và số):`);
    if (!pw) return;
    try { await admin.resetPassword(u.id, pw); alert('Đã đặt lại mật khẩu'); } catch (ex) { alert(ex.message); }
  };
  const f = (k) => ({ value: edit[k] ?? '', onChange: (e) => setEdit({ ...edit, [k]: e.target.value }) });

  return (
    <>
      <div className="row between"><h1>Người dùng quản trị</h1><button className="btn primary" onClick={() => { setErr(''); setEdit({ username: '', password: '', fullName: '', email: '', role: 'Staff', isActive: true }); }}>+ Thêm người dùng</button></div>
      {loading && <Spinner label="Đang tải…" />}{error && <ErrorBox error={error} />}
      {data && <div className="table-wrap"><table>
        <thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th /></tr></thead>
        <tbody>{data.map((u) => <tr key={u.id}><td>{u.username}{u.id === me.id && ' (bạn)'}</td><td>{u.fullName}</td><td>{u.email}</td><td>{u.role}</td><td>{u.isActive ? 'Hoạt động' : 'Đã khóa'}</td><td>{fmtDate(u.lastLoginAt)}</td>
          <td className="nowrap"><button className="btn small" onClick={() => { setErr(''); setEdit({ ...u }); }}>Sửa</button><button className="btn small" onClick={() => reset(u)}>Đặt lại MK</button></td></tr>)}</tbody></table></div>}
      {edit && (
        <Modal title={edit.id ? `Sửa ${edit.username}` : 'Thêm người dùng'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="form-grid">
            {!edit.id && <Field label="Tên đăng nhập"><input {...f('username')} required minLength={3} /></Field>}
            {!edit.id && <Field label="Mật khẩu" hint="≥ 8 ký tự, gồm chữ và số"><input type="password" {...f('password')} required /></Field>}
            <Field label="Họ tên"><input {...f('fullName')} required /></Field>
            <Field label="Email"><input type="email" {...f('email')} /></Field>
            <Field label="Vai trò"><select {...f('role')}><option value="Staff">Staff (nội dung & vé)</option><option value="Admin">Admin (toàn quyền)</option></select></Field>
            <label className="check"><input type="checkbox" checked={!!edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Cho phép đăng nhập</label>
            {err && <div className="alert error span2">{err}</div>}
            <div className="span2"><button className="btn primary">Lưu</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
