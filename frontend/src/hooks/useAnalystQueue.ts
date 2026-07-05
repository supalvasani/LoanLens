// ─────────────────────────────────────────────────────────────────────────────
// useAnalystQueue — fetches + priority-sorts the analyst review queue
// Priority: fraud-flagged first, then score ascending (lowest = most risk)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import { loanService, type AnalystQueueItem, type AnalystQueueParams } from '../services/loanService';

interface UseAnalystQueueReturn {
  /** All applications, priority-sorted */
  apps: AnalystQueueItem[];
  /** Apps that match the current search query and haven't been acted on */
  filtered: AnalystQueueItem[];
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (q: string) => void;
  /** Mark an app as actioned so it disappears from the queue optimistically */
  markDone: (id: string, action: string) => void;
  /** Map of id → action for apps that have been acted on */
  done: Record<string, string>;
  /** Refresh the queue from the server */
  refetch: () => void;
}

export function useAnalystQueue(params: AnalystQueueParams = {}): UseAnalystQueueReturn {
  const [apps, setApps]     = useState<AnalystQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [done, setDone]     = useState<Record<string, string>>({});
  const [tick, setTick]     = useState(0);

  // Track dependencies to trigger loading state during render
  const paramsKey = JSON.stringify(params);
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey);
  const [prevTick, setPrevTick] = useState(0);

  if (paramsKey !== prevParamsKey || tick !== prevTick) {
    setPrevParamsKey(paramsKey);
    setPrevTick(tick);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    loanService
      .listAnalystQueue({ sort_by: 'submitted_at', sort_dir: 'asc', limit: 200, ...params })

      .then(data => {
        // Priority sort: fraud-flagged first, then score ascending
        const sorted = [...data].sort((a, b) => {
          if (a.has_fraud_flags !== b.has_fraud_flags) return a.has_fraud_flags ? -1 : 1;
          const sa = a.score ?? 999;
          const sb = b.score ?? 999;
          return sa - sb;
        });
        setApps(sorted);
      })
      .catch(() => setError('Failed to load queue.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return apps.filter(a =>
      !done[a.application_id] &&
      (
        a.loan_type.includes(q) ||
        a.application_id.includes(q) ||
        (a.applicant_name ?? '').toLowerCase().includes(q)
      )
    );
  }, [apps, search, done]);

  function markDone(id: string, action: string) {
    setDone(prev => ({ ...prev, [id]: action }));
  }

  function refetch() {
    setTick(t => t + 1);
  }

  return { apps, filtered, loading, error, search, setSearch, markDone, done, refetch };
}
