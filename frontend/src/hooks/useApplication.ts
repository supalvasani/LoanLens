// ─────────────────────────────────────────────────────────────────────────────
// useApplication — fetches a single application by ID
// Supports standard, analyst-enriched, and manager-enriched endpoints
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { loanService } from '../services/loanService';
import { managerService } from '../services/managerService';
import type { ApplicationFull } from '../types/loan';

export type ManagerApplicationFull = ApplicationFull & {
  escalation_reason: string | null;
  escalated_by_name: string | null;
  escalated_at: string | null;
};

interface UseApplicationReturn {
  data: ManagerApplicationFull | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * @param id  Application UUID. Pass undefined/null to skip fetching.
 * @param mode 'analyst' uses analyst endpoint; 'manager' uses manager endpoint; 'standard' uses default.
 */
export function useApplication(
  id: string | undefined | null,
  mode: 'analyst' | 'manager' | 'standard' = 'standard',
): UseApplicationReturn {
  const [data, setData]       = useState<ManagerApplicationFull | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  // Track dependencies to trigger loading state during render
  const [prevId, setPrevId] = useState(id);
  const [prevMode, setPrevMode] = useState(mode);
  const [prevTick, setPrevTick] = useState(0);

  if (id !== prevId || mode !== prevMode || tick !== prevTick) {
    setPrevId(id);
    setPrevMode(mode);
    setPrevTick(tick);
    if (id) {
      setLoading(true);
      setError(null);
    } else {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;

    let fetchPromise: Promise<ManagerApplicationFull>;
    if (mode === 'analyst') {
      fetchPromise = loanService.getAnalystApplication(id) as Promise<ManagerApplicationFull>;
    } else if (mode === 'manager') {
      fetchPromise = managerService.getApplication(id);
    } else {
      fetchPromise = loanService.getApplication(id) as Promise<ManagerApplicationFull>;
    }

    fetchPromise
      .then(setData)
      .catch((err) => {
        const msg = err?.response?.data?.detail || 'Failed to load application.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [id, mode, tick]);

  function refetch() {
    setTick(t => t + 1);
  }

  return { data, loading, error, refetch };
}
