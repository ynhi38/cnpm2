import { useState } from 'react';
import { admin } from '../../lib/api';
import { useAsync, useAuth } from '../../lib/state';
import { ErrorBox, Spinner } from '../../components/Common';
import { Field, Modal } from './ui';

const BLANK = { code: '', nameVi: '', nameEn: '', nameZh: '', description: '', sortOrder: 0 };

export default function Zones() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => admin.zones(), []);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');

  const save = async (e) => {
    e.preventDefault(); setErr('');
    try { await admin.saveZone({ ...edit, sortOrder: Number(edit.sortOrder) }); setEdit(null); reload(); } catch (ex) { setErr(ex.message); }
  };
  const remove = async (z) => {
    if (!confirm(`Xóa khu ${z.Code}?`)) return;
    await admin.deleteZone(z.ZoneId).catch((e) => alert(e.message)); reload();
  };
  const f = (k) => ({ value: edit[k] ?? '', onChange: (e) => setEdit({ ...edit, [k]: e.target.value }) });

  return (
    <>
      <div className="row between"><h1>Khu / nhóm tháp</h1><button className="btn primary" onClick={() => { setErr(''); setEdit({ ...BLANK }); }}>+ Thêm khu</button></div>
      {loading && <Spinner label="Đang tải…" />}
      {error && <ErrorBox error={error} />}
      {data && <div className="table-wrap"><table>
        <thead><tr><th>Thứ tự</th><th>Mã</th><th>Tiếng Việt</th><th>English</th><th>中文</th><th>Số câu chuyện</th><th /></tr></thead>
        <tbody>{data.map((z) => (
          <tr key={z.ZoneId}><td>{z.SortOrder}</td><td>{z.Code}</td><td>{z.NameVi}</td><td>{z.NameEn}</td><td>{z.NameZh}</td><td>{z.StoryCount}</td>
            <td className="nowrap"><button className="btn small" onClick={() => { setErr(''); setEdit({ zoneId: z.ZoneId, code: z.Code, nameVi: z.NameVi, nameEn: z.NameEn, nameZh: z.NameZh, description: z.Description || '', sortOrder: z.SortOrder }); }}>Sửa</button>
              {user.role === 'Admin' && <button className="btn small danger" onClick={() => remove(z)}>Xóa</button>}</td></tr>
        ))}</tbody></table></div>}
      {edit && (
        <Modal title={edit.zoneId ? 'Sửa khu' : 'Thêm khu'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="form-grid">
            <Field label="Mã"><input {...f('code')} maxLength={10} required /></Field>
            <Field label="Thứ tự"><input type="number" {...f('sortOrder')} /></Field>
            <Field label="Tên tiếng Việt"><input {...f('nameVi')} required /></Field>
            <Field label="Tên tiếng Anh"><input {...f('nameEn')} required /></Field>
            <Field label="Tên tiếng Trung"><input {...f('nameZh')} required /></Field>
            <div className="field span2"><span>Mô tả</span><textarea rows={2} {...f('description')} /></div>
            {err && <div className="alert error span2">{err}</div>}
            <div className="span2"><button className="btn primary">Lưu</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
