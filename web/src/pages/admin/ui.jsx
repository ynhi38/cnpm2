import { useEffect } from 'react';

export const fmtDate = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between"><h2>{title}</h2><button className="btn small" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, hint, children }) => (
  <label className="field"><span>{label}</span>{children}{hint && <small className="muted">{hint}</small>}</label>
);

export function Pager({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="row gap small pager">
      <button className="btn small" disabled={page <= 1} onClick={() => onChange(page - 1)}>←</button>
      <span>Trang {page}/{pages} · {total} bản ghi</span>
      <button className="btn small" disabled={page >= pages} onClick={() => onChange(page + 1)}>→</button>
    </div>
  );
}

export function BarChart({ data, height = 140 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height / 4}`} className="barchart" preserveAspectRatio="none" role="img" aria-label="Biểu đồ cột">
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 4 - 6);
        return <g key={i}><rect x={i * w + w * 0.15} y={height / 4 - 5 - h} width={w * 0.7} height={h} rx="0.6"><title>{`${d.label}: ${d.value}`}</title></rect></g>;
      })}
    </svg>
  );
}
