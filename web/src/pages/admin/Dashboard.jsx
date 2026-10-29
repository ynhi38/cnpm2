import { Link } from 'react-router-dom';
import { admin } from '../../lib/api';
import { useAsync } from '../../lib/state';
import { ErrorBox, Spinner } from '../../components/Common';
import { BarChart } from './ui';

export default function Dashboard() {
  const { data: d, loading, error } = useAsync(() => admin.dashboard(), []);
  if (loading) return <Spinner label="Đang tải…" />;
  if (error) return <ErrorBox error={error} />;
  const { totals, tickets, listensByDay, topStories, byLanguage, bySource, missingTranslations } = d;
  const maxTop = Math.max(1, ...topStories.map((s) => s.Listens));
  const auto = bySource.filter((x) => x.Mode === 'auto').reduce((a, x) => a + x.Listens, 0);
  return (
    <>
      <h1>Tổng quan</h1>
      <div className="stat-grid">
        <div className="card stat"><b>{totals.Published}/{totals.Stories}</b><span>Câu chuyện đã xuất bản</span></div>
        <div className="card stat"><b>{totals.Listens}</b><span>Lượt nghe ({totals.ListensToday} hôm nay)</span></div>
        <div className="card stat"><b>{tickets.Activated}</b><span>Vé đang dùng ({totals.ActivatedToday} kích hoạt hôm nay)</span></div>
        <div className="card stat"><b>{tickets.Unused}</b><span>Vé chưa dùng · {tickets.Expired} hết hạn · {tickets.Revoked} thu hồi</span></div>
      </div>

      <div className="two">
        <div className="card">
          <h3>Lượt nghe 14 ngày gần nhất</h3>
          <BarChart data={listensByDay.map((x) => ({ label: x.date, value: x.listens }))} />
          <div className="row between small muted"><span>{listensByDay[0].date}</span><span>{listensByDay.at(-1).date}</span></div>
        </div>
        <div className="card">
          <h3>Theo ngôn ngữ</h3>
          {byLanguage.map((l) => <div key={l.Code} className="hbar"><span>{l.NativeName}</span><i style={{ width: `${(l.Listens / Math.max(1, ...byLanguage.map((x) => x.Listens))) * 100}%` }} /><b>{l.Listens}</b></div>)}
          <p className="muted small">Tự phát theo GPS: {auto} lượt</p>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <h3>Câu chuyện được nghe nhiều</h3>
          {topStories.map((s) => <div key={s.StoryId} className="hbar"><span>{s.Code} · {s.Title}</span><i style={{ width: `${(s.Listens / maxTop) * 100}%` }} /><b>{s.Listens}</b></div>)}
        </div>
        <div className="card">
          <h3>Nội dung còn thiếu bản dịch</h3>
          {!missingTranslations.length ? <p className="ok-text">✓ Tất cả câu chuyện đã đủ các ngôn ngữ đang bật.</p> : (
            <ul className="small">{missingTranslations.slice(0, 15).map((m, i) => <li key={i}><Link to={`/admin/stories/${m.StoryId}`}>{m.Code}</Link> thiếu <b>{m.LangCode}</b></li>)}</ul>
          )}
        </div>
      </div>
    </>
  );
}
