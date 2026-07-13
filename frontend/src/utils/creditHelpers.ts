export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--t3)';
  if (score > 65)  return '#2E7D32';
  if (score >= 45) return '#d97706';
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
  if (score > 65) return role === 'manager' ? 'High Score' : 'Approvable';
  if (score >= 45) return role === 'manager' ? 'Grey Zone' : 'Grey Zone — Escalate';
  return role === 'manager' ? 'Low Score' : 'Rejectable';
}
