/** The Decima mark: a thick ring with one opening, and a dot that has just left through it. */
const R_IN = 0.33;
const R_OUT = 0.62;
const GAP_AT = 45; // degrees clockwise from 12 o'clock
const GAP = 54; // opening width in degrees
const DOT_R = 0.135;
const DOT_AT = 0.5 * 1.18;

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}
const f = (n: number) => n.toFixed(4);

function ringPath(): string {
  const a0 = GAP_AT + GAP / 2; // start of the solid part
  const a1 = GAP_AT - GAP / 2 + 360; // end of the solid part
  const [ox0, oy0] = polar(R_OUT, a0);
  const [ox1, oy1] = polar(R_OUT, a1);
  const [ix1, iy1] = polar(R_IN, a1);
  const [ix0, iy0] = polar(R_IN, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return (
    `M${f(ox0)} ${f(oy0)}A${R_OUT} ${R_OUT} 0 ${large} 1 ${f(ox1)} ${f(oy1)}` +
    `L${f(ix1)} ${f(iy1)}A${R_IN} ${R_IN} 0 ${large} 0 ${f(ix0)} ${f(iy0)}Z`
  );
}

const [DX, DY] = polar(DOT_AT, GAP_AT);

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="-1 -1 2 2" className={className} role="img" aria-label="Decima">
      <rect x="-0.94" y="-0.94" width="1.88" height="1.88" rx="0.44" fill="#0c0c0e" stroke="#3a3a42" strokeWidth="0.06" />
      <path d={ringPath()} fill="#c8ff3d" />
      <circle cx={f(DX)} cy={f(DY)} r={DOT_R} fill="#c8ff3d" />
    </svg>
  );
}
