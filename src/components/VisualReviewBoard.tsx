import { Check, Copy, ImagePlus, ScanLine, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type { UserProfile, VisualReviewBias, VisualReviewMoment, VisualReviewRecord, WatchItem } from '../types/market';

const momentLabels: Record<VisualReviewMoment, string> = { pre: '盘前预案', live: '盘中观察', close: '收盘复盘' };
const biasLabels: Record<VisualReviewBias, string> = { bullish: '偏强', neutral: '中性', bearish: '偏弱' };

function compressImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('请选择图片文件'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('原图不能超过 8MB'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('图片格式无法识别'));
      image.onload = () => {
        const scale = Math.min(1, 1100 / image.width, 760 / image.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('浏览器无法处理图片'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', .68));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function analysisBrief(item: VisualReviewRecord, owner: string) {
  return [
    `请基于我提供的 ${item.name}（${item.symbol}）盘面截图，做一次严格的交易复盘。`,
    `账户：${owner}｜日期：${item.date}｜阶段：${momentLabels[item.moment]}｜主观倾向：${biasLabels[item.bias]}`,
    `我确认的盘面事实：${item.fact}`,
    `我的当前判断：${item.judgment}`,
    `下一步触发/失效条件：${item.nextCondition}`,
    '请区分“截图中可见事实”和“推断”，检查量价、趋势、关键位与风险；信息不足时明确说不足，不要编造。最后输出：事实、判断、风险、下一步观察四部分。'
  ].join('\n');
}

export function VisualReviewBoard({ records, users, selectedUserId, watchlist, hidden, onAdd, onDelete }: {
  records: VisualReviewRecord[];
  users: UserProfile[];
  selectedUserId: string;
  watchlist: WatchItem[];
  hidden: boolean;
  onAdd: (item: VisualReviewRecord) => void;
  onDelete: (item: VisualReviewRecord) => void;
}) {
  const activeUsers = users.filter(user => !user.archived);
  const initialUserId = selectedUserId === 'all' ? activeUsers[0]?.id ?? '' : selectedUserId;
  const [formOpen, setFormOpen] = useState(false);
  const [formUserId, setFormUserId] = useState(initialUserId);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const visibleRecords = useMemo(() => records
    .filter(item => selectedUserId === 'all' || item.userId === selectedUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [records, selectedUserId]);
  const formWatchlist = watchlist.filter(item => (item.userId ?? activeUsers[0]?.id) === formUserId);
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());

  useEffect(() => setFormUserId(initialUserId), [initialUserId]);

  const selectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      setImageDataUrl(await compressImage(file));
      setImageName(file.name);
    } catch (reason) {
      setImageDataUrl('');
      setImageName('');
      setError(reason instanceof Error ? reason.message : '图片处理失败');
    }
  };

  const addRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!imageDataUrl) return setError('请先添加一张盘面截图');
    const data = new FormData(event.currentTarget);
    const symbol = String(data.get('symbol'));
    const stock = formWatchlist.find(item => item.symbol === symbol);
    if (!stock) return setError('请选择观察池中的标的');
    onAdd({
      id: crypto.randomUUID(), userId: formUserId, date: String(data.get('date')),
      symbol, name: stock.name, moment: String(data.get('moment')) as VisualReviewMoment,
      bias: String(data.get('bias')) as VisualReviewBias, imageDataUrl, imageName,
      fact: String(data.get('fact')).trim(), judgment: String(data.get('judgment')).trim(),
      nextCondition: String(data.get('nextCondition')).trim(), createdAt: new Date().toISOString()
    });
    setFormOpen(false);
    setImageDataUrl('');
    setImageName('');
    setError('');
  };

  const copyBrief = async (item: VisualReviewRecord) => {
    const owner = users.find(user => user.id === item.userId)?.name ?? '未命名账户';
    await navigator.clipboard.writeText(analysisBrief(item, owner));
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId(''), 1600);
  };

  return <section className="visual-review card">
    <div className="visual-review-head">
      <div><span className="eyebrow">VISUAL EVIDENCE · V0.9</span><h3><ScanLine size={20}/>盘面证据库</h3><p>把截图、事实与行动边界放在同一条记录里，再交给 AI 做有依据的复盘。</p></div>
      <button className="primary-btn" onClick={() => setFormOpen(true)}><ImagePlus size={16}/>添加盘面截图</button>
    </div>

    <div className="evidence-strip">
      <span><i></i>本机图片</span><span>{visibleRecords.length} 条证据</span><span>AI READY FORMAT</span>
    </div>

    {visibleRecords.length ? <div className="evidence-grid">{visibleRecords.map(item => {
      const owner = users.find(user => user.id === item.userId);
      return <article className="evidence-card" key={item.id}>
        <div className={`evidence-image-wrap ${hidden ? 'privacy' : ''}`}>
          <img src={item.imageDataUrl} alt={hidden ? '已隐藏的盘面截图' : `${item.name} ${momentLabels[item.moment]}截图`}/>
          {hidden && <span>PRIVACY MODE</span>}
          <b>{momentLabels[item.moment]}</b>
        </div>
        <div className="evidence-body">
          <div className="evidence-title"><div><span style={{ background: owner?.color ?? '#f2b84b' }}></span><strong>{hidden ? '观察标的' : item.name}</strong><small>{hidden ? '••••••' : item.symbol} · {owner?.name ?? '未命名账户'}</small></div><em className={item.bias}>{biasLabels[item.bias]}</em></div>
          <dl><div><dt>事实</dt><dd>{item.fact}</dd></div><div><dt>判断</dt><dd>{item.judgment}</dd></div><div><dt>下一步条件</dt><dd>{item.nextCondition}</dd></div></dl>
          <div className="evidence-footer"><time>{item.date}</time><div><button className="tiny-add" onClick={() => void copyBrief(item)}>{copiedId === item.id ? <Check size={14}/> : <Copy size={14}/>} {copiedId === item.id ? '已复制' : '复制 AI 简报'}</button><button className="tiny-btn danger" title={`删除 ${item.name} 盘面记录`} onClick={() => onDelete(item)}><Trash2 size={14}/></button></div></div>
        </div>
      </article>;
    })}</div> : <div className="evidence-empty"><ScanLine size={34}/><b>还没有盘面证据</b><span>从下一张分时图或 K 线截图开始，把“看见什么”和“准备怎么做”分开记录。</span><button className="ghost-btn" onClick={() => setFormOpen(true)}>添加第一张截图</button></div>}

    <p className="evidence-disclaimer"><Sparkles size={14}/>本阶段生成的是供 AI 使用的结构化简报，不会自动上传图片或虚构看图结论。</p>

    {formOpen && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setFormOpen(false)}>
      <form className="modal visual-review-modal" onSubmit={addRecord}>
        <div className="modal-head"><div><span className="eyebrow">CHART EVIDENCE INTAKE</span><h3>添加盘面证据</h3></div><button type="button" className="icon-btn" onClick={() => setFormOpen(false)}><X size={19}/></button></div>
        <div className="visual-review-form">
          <label className={`image-drop ${imageDataUrl ? 'ready' : ''}`}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void selectImage(event)}/>{imageDataUrl ? <img src={imageDataUrl} alt="待保存的盘面截图"/> : <><ImagePlus size={30}/><b>选择盘面截图</b><span>PNG / JPG / WebP · 原图最大 8MB</span></>}</label>
          <div className="form-grid">
            <label><span>账户</span><select value={formUserId} onChange={event => setFormUserId(event.target.value)}>{activeUsers.map(user => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
            <label><span>标的</span><select name="symbol" required>{formWatchlist.map(item => <option value={item.symbol} key={`${item.userId}-${item.symbol}`}>{item.name} · {item.symbol}</option>)}</select></label>
            <label><span>日期</span><input name="date" type="date" defaultValue={today} required/></label>
            <label><span>阶段</span><select name="moment" defaultValue="live"><option value="pre">盘前预案</option><option value="live">盘中观察</option><option value="close">收盘复盘</option></select></label>
            <label><span>盘面倾向</span><select name="bias" defaultValue="neutral"><option value="bullish">偏强</option><option value="neutral">中性</option><option value="bearish">偏弱</option></select></label>
            <label className="full-field"><span>截图中确认的事实</span><textarea name="fact" placeholder="只写可见事实，例如：放量突破 289 后回踩未破" required/></label>
            <label className="full-field"><span>当前判断</span><textarea name="judgment" placeholder="例如：短线转强，但尚未确认持续性" required/></label>
            <label className="full-field"><span>下一步触发 / 失效条件</span><textarea name="nextCondition" placeholder="例如：站稳 289 才考虑执行；跌回 278 下方失效" required/></label>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><span>图片压缩后仅保存于当前浏览器</span><button type="button" className="ghost-btn" onClick={() => setFormOpen(false)}>取消</button><button className="primary-btn" type="submit">保存盘面证据</button></div>
      </form>
    </div>}
  </section>;
}
