import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { admin, assetUrl } from '../../lib/api';
import { LANGS } from '../../lib/i18n';
import { useSpeech } from '../../lib/speech';
import { useAsync } from '../../lib/state';
import { Spinner } from '../../components/Common';
import { Field } from './ui';

const EMPTY_T = { title: '', summary: '', content: '', audioUrl: '' };
const BLANK = { code: '', zoneId: '', sortOrder: 0, imageUrl: '', latitude: '', longitude: '', mapX: '', mapY: '', triggerRadiusM: 30, isPublished: true, isPreview: false, translations: { vi: { ...EMPTY_T }, en: { ...EMPTY_T }, zh: { ...EMPTY_T } } };

function Preview({ text, locale }) {
  const sp = useSpeech(text, locale);
  if (!sp.supported || !text) return null;
  return <button type="button" className="btn small" onClick={sp.status === 'idle' ? sp.play : sp.stop}>{sp.status === 'idle' ? '▶ Nghe thử giọng đọc' : '■ Dừng'}</button>;
}

export default function StoryForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const zones = useAsync(() => admin.zones(), []);
  const [f, setF] = useState(null);
  const [tab, setTab] = useState('vi');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) { setF(BLANK); return; }
    admin.story(id).then((s) => {
      const translations = { vi: { ...EMPTY_T }, en: { ...EMPTY_T }, zh: { ...EMPTY_T } };
      s.translations.forEach((t) => { translations[t.LangCode] = { title: t.Title || '', summary: t.Summary || '', content: t.Content || '', audioUrl: t.AudioUrl || '' }; });
      setF({ code: s.Code, zoneId: s.ZoneId, sortOrder: s.SortOrder, imageUrl: s.ImageUrl || '', latitude: s.Latitude ?? '', longitude: s.Longitude ?? '', mapX: s.MapX ?? '', mapY: s.MapY ?? '', triggerRadiusM: s.TriggerRadiusM, isPublished: !!s.IsPublished, isPreview: !!s.IsPreview, translations });
    }).catch((e) => setErr(e.message));
  }, [id, isNew]);

  if (!f) return err ? <div className="alert error">{err}</div> : <Spinner label="Đang tải…" />;

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setT = (k, v) => setF((x) => ({ ...x, translations: { ...x.translations, [tab]: { ...x.translations[tab], [k]: v } } }));
  const t = f.translations[tab];
  const done = (c) => !!(f.translations[c].title && f.translations[c].content);

  const upload = async (kind, setter) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = kind === 'image' ? 'image/jpeg,image/png,image/webp' : 'audio/*';
    input.onchange = async () => {
      if (!input.files[0]) return;
      try { setter(await admin.upload(kind, input.files[0])); } catch (e) { setErr(e.message); }
    };
    input.click();
  };

  const save = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const body = { ...f, zoneId: Number(f.zoneId) };
      const saved = await admin.saveStory(isNew ? null : id, body);
      if (isNew) nav(`/admin/stories/${saved.StoryId}`, { replace: true }); else alert('Đã lưu');
    } catch (ex) { setErr(ex.message); window.scrollTo(0, 0); }
    setBusy(false);
  };

  return (
    <form onSubmit={save}>
      <div className="row between"><h1>{isNew ? 'Thêm câu chuyện' : `Sửa câu chuyện ${f.code}`}</h1><div className="row gap"><button type="button" className="btn" onClick={() => nav('/admin/stories')}>Quay lại</button><button className="btn primary" disabled={busy}>Lưu</button></div></div>
      {err && <div className="alert error">{err}</div>}

      <div className="card form-grid">
        <Field label="Mã (in trên QR điểm tham quan)"><input value={f.code} onChange={(e) => set('code', e.target.value)} required maxLength={20} /></Field>
        <Field label="Khu / nhóm tháp">
          <select value={f.zoneId} onChange={(e) => set('zoneId', e.target.value)} required><option value="">— chọn —</option>{zones.data?.map((z) => <option key={z.ZoneId} value={z.ZoneId}>{z.NameVi}</option>)}</select>
        </Field>
        <Field label="Thứ tự"><input type="number" min="0" value={f.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></Field>
        <Field label="Bán kính tự phát (m)" hint="5 – 500"><input type="number" min="5" max="500" value={f.triggerRadiusM} onChange={(e) => set('triggerRadiusM', e.target.value)} /></Field>
        <Field label="Vĩ độ"><input type="number" step="any" value={f.latitude} onChange={(e) => set('latitude', e.target.value)} /></Field>
        <Field label="Kinh độ"><input type="number" step="any" value={f.longitude} onChange={(e) => set('longitude', e.target.value)} /></Field>
        <Field label="Vị trí sơ đồ X (%)"><input type="number" step="any" min="0" max="100" value={f.mapX} onChange={(e) => set('mapX', e.target.value)} /></Field>
        <Field label="Vị trí sơ đồ Y (%)"><input type="number" step="any" min="0" max="100" value={f.mapY} onChange={(e) => set('mapY', e.target.value)} /></Field>
        <div className="field span2">
          <span>Ảnh minh họa</span>
          <div className="row gap">
            {f.imageUrl && <img className="thumb" src={assetUrl(f.imageUrl)} alt="" />}
            <button type="button" className="btn small" onClick={() => upload('image', (u) => set('imageUrl', u))}>Tải ảnh lên</button>
            {f.imageUrl && <button type="button" className="btn small" onClick={() => set('imageUrl', '')}>Bỏ ảnh</button>}
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={f.isPublished} onChange={(e) => set('isPublished', e.target.checked)} /> Xuất bản</label>
        <label className="check"><input type="checkbox" checked={f.isPreview} onChange={(e) => set('isPreview', e.target.checked)} /> Nghe thử miễn phí (không cần vé)</label>
      </div>

      <div className="card">
        <div className="tabs">
          {LANGS.map((l) => <button type="button" key={l.code} className={tab === l.code ? 'on' : ''} onClick={() => setTab(l.code)}>{l.label} {done(l.code) ? '✓' : '○'}</button>)}
        </div>
        <Field label={`Tiêu đề (${tab})`}><input value={t.title} onChange={(e) => setT('title', e.target.value)} maxLength={200} /></Field>
        <Field label="Tóm tắt (hiển thị ở danh sách)"><input value={t.summary} onChange={(e) => setT('summary', e.target.value)} maxLength={500} /></Field>
        <Field label="Nội dung thuyết minh" hint="Nên viết số/năm bằng chữ (ví dụ “một nghìn chín trăm chín mươi chín”) để giọng đọc tự động phát âm đúng.">
          <textarea rows={10} value={t.content} onChange={(e) => setT('content', e.target.value)} />
        </Field>
        <div className="field">
          <span>File âm thanh thu sẵn (tùy chọn — nếu trống sẽ đọc tự động bằng TTS)</span>
          <div className="row gap wrapflex">
            <button type="button" className="btn small" onClick={() => upload('audio', (u) => setT('audioUrl', u))}>Tải audio lên</button>
            {t.audioUrl && <><audio controls src={assetUrl(t.audioUrl)} /><button type="button" className="btn small" onClick={() => setT('audioUrl', '')}>Bỏ audio</button></>}
            <Preview text={t.content} locale={LANGS.find((l) => l.code === tab).locale} />
          </div>
        </div>
        <p className="muted small">Để trống tiêu đề và nội dung của một ngôn ngữ để xóa bản dịch đó. Câu chuyện xuất bản bắt buộc có bản tiếng Việt.</p>
      </div>
    </form>
  );
}
