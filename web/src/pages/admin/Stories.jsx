import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../lib/api';
import { useAsync, useAuth } from '../../lib/state';
import { ErrorBox, Spinner } from '../../components/Common';
import { Pager } from './ui';

export default function StoriesAdmin() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [zone, setZone] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const id = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(id); }, [q]);
  const zones = useAsync(() => admin.zones(), []);
  const { data, loading, error, reload } = useAsync(() => admin.stories({ q: dq, zone, page, pageSize: 20 }), [dq, zone, page]);

  const toggle = async (s) => { await admin.publishStory(s.StoryId, !s.IsPublished).catch((e) => alert(e.message)); reload(); };
  const remove = async (s) => {
    if (!confirm(`Xóa câu chuyện ${s.Code}? Toàn bộ bản dịch và nhật ký nghe liên quan sẽ bị xóa.`)) return;
    await admin.deleteStory(s.StoryId).catch((e) => alert(e.message)); reload();
  };

  return (
    <>
      <div className="row between"><h1>Câu chuyện</h1><Link className="btn primary" to="/admin/stories/new">+ Thêm câu chuyện</Link></div>
      <div className="toolbar row gap">
        <input type="search" placeholder="Tìm theo mã / tiêu đề…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={zone} onChange={(e) => { setZone(e.target.value); setPage(1); }}>
          <option value="">Tất cả khu</option>
          {zones.data?.map((z) => <option key={z.ZoneId} value={z.ZoneId}>{z.NameVi}</option>)}
        </select>
      </div>
      {loading && <Spinner label="Đang tải…" />}
      {error && <ErrorBox error={error} />}
      {data && (
        <>
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>Mã</th><th>Tiêu đề (VI)</th><th>Khu</th><th>Ngôn ngữ</th><th>Audio</th><th>Lượt nghe</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.StoryId}>
                  <td>{s.SortOrder}</td><td><Link to={`/admin/stories/${s.StoryId}`}>{s.Code}</Link></td><td>{s.TitleVi}</td><td>{s.ZoneName}</td>
                  <td>{(s.Languages || '').split(',').filter(Boolean).map((c) => <span key={c} className="tag">{c}</span>)}</td>
                  <td>{s.AudioFiles}</td><td>{s.TotalListens}</td>
                  <td><button className={`tag btnlike ${s.IsPublished ? 'free' : 'lock'}`} onClick={() => toggle(s)}>{s.IsPublished ? 'Đã xuất bản' : 'Bản nháp'}</button>{s.IsPreview ? <span className="tag">nghe thử</span> : null}</td>
                  <td className="nowrap"><Link className="btn small" to={`/admin/stories/${s.StoryId}`}>Sửa</Link>{user.role === 'Admin' && <button className="btn small danger" onClick={() => remove(s)}>Xóa</button>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}
