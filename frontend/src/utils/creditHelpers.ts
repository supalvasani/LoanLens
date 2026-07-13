export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--t3)';
  if (score > 65) return '#2E7D32';
  if (score >= 45) return '#d97706';
  return '#C62828';
}

export function getScoreBarColor(value: number): string {
  if (value >= 70) return '#2E7D32';
  if (value >= 45) return '#d97706';
  return '#C62828';
}

export function getRiskSegmentColor(segment?: string | null): string {
  if (segment === 'high') return 'var(--bad)';
  if (segment === 'medium') return '#d97706';
  return 'var(--ok)';
}

export function getDecisionBadgeClass(decision: string): string {
  if (decision === 'approved') return 'badge-ok';
  if (decision === 'rejected') return 'badge-bad';
  return 'badge-warn';
}

export const PIE_COLORS = ['#4F81C7', '#2E7D32', '#d97706', '#C62828', '#7C3AED', '#0891b2'];

export function getScoreGaugeLabel(score: number, role: 'manager' | 'analyst' = 'analyst'): string {
  if (role === 'manager') {
    if (score > 65) return 'High Score';
    if (score >= 45) return 'Grey Zone';
    return 'Low Score';
  }
  if (score > 65) return 'Approvable';
  if (score >= 45) return 'Grey Zone — Escalate';
  return 'Rejectable';
}
