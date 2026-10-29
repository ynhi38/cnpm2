import { useEffect, useState } from 'react';
import { admin } from '../../lib/api';
import { useAsync, useAuth } from '../../lib/state';
import { ErrorBox, Spinner } from '../../components/Common';
import { Field, Modal, Pager, fmtDate } from './ui';

const STATUS = { Unused: 'Chưa dùng', Activated: 'Đang dùng', Expired: 'Hết hạn', Revoked: 'Thu hồi' };

export default function Tickets() {
  const { user } = useAuth();
  const [tab, setTab] = useState('tickets');
  const [f, setF] = useState({ status: '', batch: '', q: '' });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [gen, setGen] = useState(null);
  const [typeEdit, setTypeEdit] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { const id = setTimeout(() => { setF((x) => ({ ...x, q })); setPage(1); }, 300); return () => clearTimeout(id); }, [q]);

  const types = useAsync(() => admin.ticketTypes(), []);
  const batches = useAsync(() => admin.ticketBatches(), []);
  const list = useAsync(() => admin.tickets({ ...f, page, pageSize: 25 }), [f.status, f.batch, f.q, page]);
  const reloadAll = () => { list.reload(); batches.reload(); types.reload(); };

  const generate = async (e) => {
    e.preventDefault(); setMsg('');
    try {
      const r = await admin.generateTickets({ ...gen, ticketTypeId: Number(gen.ticketTypeId), quantity: Number(gen.quantity) });
      setGen(null); setF({ ...f, batch: r.batchCode }); setTab('tickets'); setPage(1); reloadAll();
      alert(`Đã phát hành ${r.quantity} vé, lô ${r.batchCode}. Bạn có thể xuất CSV để in.`);
    } catch (ex) { setMsg(ex.message); }
  };
  const revoke = async (t) => { if (confirm(`Thu hồi vé ${t.Code}?`)) { await admin.revokeTicket(t.TicketId).catch((e) => alert(e.message)); reloadAll(); } };
  const exportCsv = async () => {
    try {
      const blob = await admin.exportTickets({ status: f.status, batch: f.batch, q: f.q });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'tickets.csv'; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { alert(e.message); }
  };
  const saveType = async (e) => {
    e.preventDefault(); setMsg('');
    try { await admin.saveTicketType({ ...typeEdit, validHours: Number(typeEdit.validHours), price: Number(typeEdit.price) }); setTypeEdit(null); types.reload(); } catch (ex) { setMsg(ex.message); }
  };

  return (
    <>
      <div className="row between wrapflex"><h1>Vé & mã truy cập</h1>
        <button className="btn primary" onClick={() => { setMsg(''); setGen({ ticketTypeId: types.data?.find((x) => x.IsActive)?.TicketTypeId || '', quantity: 50, prefix: 'MS', batchCode: '' }); }}>+ Phát hành vé</button></div>
      <div className="tabs"><button className={tab === 'tickets' ? 'on' : ''} onClick={() => setTab('tickets')}>Danh sách vé</button><button className={tab === 'batches' ? 'on' : ''} onClick={() => setTab('batches')}>Lô phát hành</button><button className={tab === 'types' ? 'on' : ''} onClick={() => setTab('types')}>Loại vé</button></div>

      {tab === 'tickets' && (
        <>
          <div className="toolbar row gap wrapflex">
            <input type="search" placeholder="Tìm mã vé…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }}><option value="">Mọi trạng thái</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select value={f.batch} onChange={(e) => { setF({ ...f, batch: e.target.value }); setPage(1); }}><option value="">Mọi lô</option>{batches.data?.map((b) => <option key={b.BatchCode}>{b.BatchCode}</option>)}</select>
            <button className="btn" onClick={exportCsv}>⬇ Xuất CSV</button>
          </div>
          {list.loading && <Spinner label="Đang tải…" />}{list.error && <ErrorBox error={list.error} />}
          {list.data && <><div className="table-wrap"><table>
            <thead><tr><th>Mã vé</th><th>Lô</th><th>Loại</th><th>Trạng thái</th><th>Kích hoạt</th><th>Hết hạn</th><th>Ngôn ngữ</th><th>Người phát hành</th><th /></tr></thead>
            <tbody>{list.data.items.map((t) => (
              <tr key={t.TicketId}><td><code>{t.Code}</code></td><td>{t.BatchCode}</td><td>{t.TypeName}</td><td><span className={`tag st-${t.Status}`}>{STATUS[t.Status]}</span></td><td>{fmtDate(t.ActivatedAt)}</td><td>{fmtDate(t.ExpiresAt)}</td><td>{t.LangCode || '—'}</td><td>{t.IssuedByName || '—'}</td>
                <td>{t.Status !== 'Revoked' && <button className="btn small danger" onClick={() => revoke(t)}>Thu hồi</button>}</td></tr>
            ))}</tbody></table></div>
            <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} /></>}
        </>
      )}

      {tab === 'batches' && batches.data && <div className="table-wrap"><table>
        <thead><tr><th>Lô</th><th>Loại</th><th>Ngày phát hành</th><th>Tổng</th><th>Chưa dùng</th><th>Đang dùng</th><th>Hết hạn</th><th>Thu hồi</th><th /></tr></thead>
        <tbody>{batches.data.map((b) => <tr key={b.BatchCode}><td>{b.BatchCode}</td><td>{b.TypeName}</td><td>{fmtDate(b.IssuedAt)}</td><td>{b.Total}</td><td>{b.Unused}</td><td>{b.Active}</td><td>{b.Expired}</td><td>{b.Revoked}</td>
          <td><button className="btn small" onClick={() => { setF({ status: '', batch: b.BatchCode, q: '' }); setPage(1); setTab('tickets'); }}>Xem vé</button></td></tr>)}</tbody></table></div>}

      {tab === 'types' && types.data && (
        <>
          {user.role === 'Admin' && <button className="btn" onClick={() => { setMsg(''); setTypeEdit({ name: '', validHours: 24, price: 0, isActive: true }); }}>+ Thêm loại vé</button>}
          <div className="table-wrap"><table>
            <thead><tr><th>Tên</th><th>Hiệu lực (giờ)</th><th>Giá (VND)</th><th>Số vé</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{types.data.map((t) => <tr key={t.TicketTypeId}><td>{t.Name}</td><td>{t.ValidHours}</td><td>{Number(t.Price).toLocaleString('vi-VN')}</td><td>{t.TicketCount}</td><td>{t.IsActive ? 'Đang bán' : 'Tắt'}</td>
              <td>{user.role === 'Admin' && <button className="btn small" onClick={() => { setMsg(''); setTypeEdit({ ticketTypeId: t.TicketTypeId, name: t.Name, validHours: t.ValidHours, price: t.Price, isActive: !!t.IsActive }); }}>Sửa</button>}</td></tr>)}</tbody></table></div>
        </>
      )}

      {gen && (
        <Modal title="Phát hành vé hàng loạt" onClose={() => setGen(null)}>
          <form onSubmit={generate} className="form-grid">
            <Field label="Loại vé"><select value={gen.ticketTypeId} onChange={(e) => setGen({ ...gen, ticketTypeId: e.target.value })} required><option value="">— chọn —</option>{types.data?.filter((t) => t.IsActive).map((t) => <option key={t.TicketTypeId} value={t.TicketTypeId}>{t.Name} ({t.ValidHours}h)</option>)}</select></Field>
            <Field label="Số lượng (1–1000)"><input type="number" min="1" max="1000" value={gen.quantity} onChange={(e) => setGen({ ...gen, quantity: e.target.value })} required /></Field>
            <Field label="Tiền tố mã" hint="2–6 chữ/số, ví dụ MS → MS-AB12-CD34"><input value={gen.prefix} onChange={(e) => setGen({ ...gen, prefix: e.target.value.toUpperCase() })} maxLength={6} /></Field>
            <Field label="Tên lô (tùy chọn)"><input value={gen.batchCode} onChange={(e) => setGen({ ...gen, batchCode: e.target.value })} maxLength={30} /></Field>
            {msg && <div className="alert error span2">{msg}</div>}
            <div className="span2"><button className="btn primary">Phát hành</button></div>
          </form>
        </Modal>
      )}
      {typeEdit && (
        <Modal title={typeEdit.ticketTypeId ? 'Sửa loại vé' : 'Thêm loại vé'} onClose={() => setTypeEdit(null)}>
          <form onSubmit={saveType} className="form-grid">
            <div className="field span2"><span>Tên</span><input value={typeEdit.name} onChange={(e) => setTypeEdit({ ...typeEdit, name: e.target.value })} required /></div>
            <Field label="Hiệu lực (giờ)"><input type="number" min="1" value={typeEdit.validHours} onChange={(e) => setTypeEdit({ ...typeEdit, validHours: e.target.value })} required /></Field>
            <Field label="Giá (VND)"><input type="number" min="0" value={typeEdit.price} onChange={(e) => setTypeEdit({ ...typeEdit, price: e.target.value })} /></Field>
            <label className="check"><input type="checkbox" checked={typeEdit.isActive} onChange={(e) => setTypeEdit({ ...typeEdit, isActive: e.target.checked })} /> Đang bán</label>
            {msg && <div className="alert error span2">{msg}</div>}
            <div className="span2"><button className="btn primary">Lưu</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
