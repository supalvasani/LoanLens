// ─────────────────────────────────────────────────────────────────────────────
// useManagerQueue — fetches escalated applications for the manager queue
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { loanService } from '../services/loanService';
import type { LoanApplication } from '../types/loan';

interface UseManagerQueueReturn {
  apps: LoanApplication[];
  loading: boolean;
  error: string | null;
  /** Mark an app as actioned (optimistic removal) */
  markDone: (id: string, decision: string) => void;
  done: Record<string, string>;
  refetch: () => void;
}

export function useManagerQueue(): UseManagerQueueReturn {
  const [apps, setApps]     = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [done, setDone]     = useState<Record<string, string>>({});
  const [tick, setTick]     = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loanService
      .getApplications()
      .then(all => setApps(all.filter(a => a.status === 'escalated')))
      .catch(() => setError('Failed to load escalations.'))
      .finally(() => setLoading(false));
  }, [tick]);

  function markDone(id: string, decision: string) {
    setDone(prev => ({ ...prev, [id]: decision }));
  }

  function refetch() {
    setTick(t => t + 1);
  }

  return { apps, loading, error, markDone, done, refetch };
}
