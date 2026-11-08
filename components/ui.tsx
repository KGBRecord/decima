import clsx from 'clsx';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-lg bg-ink-800 border border-ink-900/60 p-3', className)}>{children}</div>;
}

export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'success' }) {
  return (
    <button
      {...p}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
        variant === 'primary' && 'bg-blurple hover:bg-blurple-dark text-white',
        variant === 'success' && 'bg-ok hover:brightness-110 text-white',
        variant === 'danger' && 'bg-bad hover:brightness-110 text-white',
        variant === 'ghost' && 'bg-ink-600 hover:bg-ink-600/70 text-white',
        className,
      )}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-zinc-500">{hint}</div>}
    </label>
  );
}

export const inputCls = 'w-full rounded-md bg-ink-900 border border-ink-600 px-2 py-1.5 text-white outline-none focus:border-blurple';

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
      tone === 'ok' && 'bg-ok/20 text-ok', tone === 'warn' && 'bg-warn/20 text-warn',
      tone === 'bad' && 'bg-bad/20 text-bad', tone === 'muted' && 'bg-ink-600 text-zinc-300')}>
      {children}
    </span>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-900">
      <div className="h-full bg-ok transition-all duration-300" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
