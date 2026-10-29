import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/state';

const MENU = [
  ['/admin', 'Tổng quan', false, true],
  ['/admin/stories', 'Câu chuyện', false],
  ['/admin/zones', 'Khu / nhóm tháp', false],
  ['/admin/tickets', 'Vé & mã truy cập', false],
  ['/admin/users', 'Người dùng', true],
  ['/admin/settings', 'Cấu hình', false],
  ['/admin/audit', 'Nhật ký', true],
];

export default function AdminLayout() {
  const { user, ready, logout } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="center muted">Đang tải…</div>;
  if (!user) return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />;
  return (
    <div className="admin">
      <aside className="side">
        <div className="brand"><span className="logo">▲</span> Mỹ Sơn Admin</div>
        <nav>
          {MENU.filter(([, , adminOnly]) => !adminOnly || user.role === 'Admin').map(([to, label, , end]) => (
            <NavLink key={to} to={to} end={!!end}>{label}</NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="small">{user.fullName}<br /><span className="muted">{user.role}</span></div>
          <NavLink to="/" className="btn small">Xem trang khách</NavLink>
          <button className="btn small" onClick={logout}>Đăng xuất</button>
        </div>
      </aside>
      <section className="admin-main"><Outlet /></section>
    </div>
  );
}
