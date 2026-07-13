import React from 'react';
import { DashboardShell } from '../DashboardShell';
import { scoreColor, getScoreGaugeLabel } from '../../utils/creditHelpers';

export function SectionHeader({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
      textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

export interface MetricRowProps {
  readonly label: string;
  readonly value: string | number;
  readonly note?: string;
  readonly alert?: boolean;
}

export function MetricRow({ label, value, note, alert }: Readonly<MetricRowProps>) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--border-s)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: alert ? 'var(--bad)' : 'var(--t1)' }}>{value}</span>
        {note && <div style={{ fontSize: 11, color: alert ? 'var(--bad)' : 'var(--t3)' }}>{note}</div>}
      </div>
    </div>
  );
}

export function ScoreGauge({ score, role = 'analyst' }: Readonly<{ score: number; role?: 'manager' | 'analyst' }>) {
  const color = scoreColor(score);
  const label = getScoreGaugeLabel(score, role);
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 64, fontWeight: 900, color, letterSpacing: '-0.05em', lineHeight: 1 }}>
        {score.toFixed(0)}
      </div>
      <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 6 }}>{label}</div>
      <div style={{ marginTop: 14, height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.min(100, score)}%`,
          background: color, borderRadius: 99, transition: 'width .8s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--t3)' }}>
        <span>0</span><span>45</span><span>65</span><span>100</span>
      </div>
    </div>
  );
}

export function DetailLoadingState() {
  return (
    <DashboardShell title="Loading…" subtitle="Fetching credit report">
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--t3)' }}>
        <span className="spinner" style={{ fontSize: 20, marginRight: 8 }} />{' '}
        Loading application…
      </div>
    </DashboardShell>
  );
}

export function DetailErrorState({ error, onBack }: Readonly<{ error: string; onBack: () => void }>) {
  return (
    <DashboardShell title="Error">
      <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>
      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onBack}>
        ← Back
      </button>
    </DashboardShell>
  );
}

export function DetailActionDoneState({
  id,
  actionDone,
  onQueue,
  onDashboard,
}: Readonly<{
  id?: string;
  actionDone: string;
  onQueue: () => void;
  onDashboard: () => void;
}>) {
  const message = actionDone === 'escalated'
    ? 'escalated to Bank Manager'
    : actionDone === 'approved'
    ? 'Approved'
    : actionDone === 'rejected'
    ? 'Rejected'
    : actionDone;

  return (
    <DashboardShell title="Decision Recorded">
      <div className="alert alert-success" style={{ marginBottom: 20 }}>
        <span>✓</span>
        <span>
          Application <strong>{id?.slice(0, 8)}…</strong> has been <strong>{message}</strong>.
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onQueue}>
          ← Back to Queue
        </button>
        <button className="btn btn-ghost" onClick={onDashboard}>
          Dashboard
        </button>
      </div>
    </DashboardShell>
  );
}
