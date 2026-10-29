import { useState } from 'react';
import { admin } from '../../lib/api';
import { useAsync } from '../../lib/state';
import { ErrorBox, Spinner } from '../../components/Common';
import { Pager, fmtDate } from './ui';

export default function Audit() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync(() => admin.auditLogs({ page, pageSize: 50 }), [page]);
  return (
    <>
      <h1>Nhật ký thao tác</h1>
      {loading && <Spinner label="Đang tải…" />}{error && <ErrorBox error={error} />}
      {data && <><div className="table-wrap"><table>
        <thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
        <tbody>{data.items.map((a) => <tr key={a.AuditId}><td>{fmtDate(a.CreatedAt)}</td><td>{a.Username || '—'}</td><td>{a.Action}</td><td>{a.Entity} {a.EntityId}</td><td>{a.Detail}</td></tr>)}</tbody></table></div>
        <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} /></>}
    </>
  );
}
