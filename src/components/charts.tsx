export interface Seg { label: string; val: number; color: string; }

export function Donut({ segs, size = 148, centerTop = "", centerBot = "" }: { segs: Seg[]; size?: number; centerTop?: string; centerBot?: string }) {
  const total = segs.reduce((s, x) => s + x.val, 0);
  const r = 58, c = 2 * Math.PI * r, cx = size / 2, cy = size / 2;
  let off = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Distribución" className="shrink-0">
      {total === 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={18} />}
      {segs.filter((s) => s.val > 0).map((s, i) => {
        const len = (s.val / total) * c;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={18}
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${cx} ${cy})`}>
            <title>{`${s.label}: ${s.val} (${Math.round((s.val / total) * 100)}%)`}</title>
          </circle>
        );
        off += len; return el;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-ink font-bold tracking-tight" style={{ fontSize: 26 }}>{centerTop}</text>
      <text x={cx} y={cy + 15} textAnchor="middle" className="fill-ink2 uppercase" style={{ fontSize: 11, letterSpacing: ".06em" }}>{centerBot}</text>
    </svg>
  );
}

export function Gauge({ pct, color }: { pct: number; color: string }) {
  const p = Math.max(0, Math.min(100, pct)), r = 52, c = Math.PI * r, len = (p / 100) * c;
  return (
    <svg viewBox="0 0 130 78" width={130} height={78} role="img" aria-label={`${p}%`}>
      <path d="M13 70 A52 52 0 0 1 117 70" fill="none" stroke="var(--surface2)" strokeWidth={13} strokeLinecap="round" />
      <path d="M13 70 A52 52 0 0 1 117 70" fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" strokeDasharray={`${len} ${c}`} />
      <text x={65} y={62} textAnchor="middle" className="fill-ink font-bold tracking-tight" style={{ fontSize: 22 }}>{p}%</text>
    </svg>
  );
}

export function Legend({ segs }: { segs: Seg[] }) {
  return (
    <div className="flex flex-col gap-[7px] flex-1 min-w-[150px]">
      {segs.map((s, i) => (
        <div key={i} className="flex items-center gap-2.5 text-[13.5px]">
          <i className="w-[11px] h-[11px] rounded-[3px] shrink-0" style={{ background: s.color }} />
          <span className="flex-1 truncate">{s.label}</span>
          <b className="tnum">{s.val}</b>
        </div>
      ))}
    </div>
  );
}
