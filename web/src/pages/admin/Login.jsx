import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/state';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={loc.state?.from || '/admin'} replace />;

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(f.username, f.password); nav(loc.state?.from || '/admin', { replace: true }); }
    catch (ex) { setErr(ex.message); }
    setBusy(false);
  };
  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <div className="brand"><span className="logo">▲</span> Mỹ Sơn Admin</div>
        <h2>Đăng nhập quản trị</h2>
        <input placeholder="Tên đăng nhập" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" required />
        <input type="password" placeholder="Mật khẩu" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" required />
        {err && <div className="alert error">{err}</div>}
        <button className="btn primary lg" disabled={busy}>Đăng nhập</button>
      </form>
    </div>
  );
}
