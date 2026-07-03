// ─────────────────────────────────────────────────────────────────────────────
// useApplication — fetches a single application by ID
// Supports both the standard endpoint and the analyst-enriched endpoint
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { loanService } from '../services/loanService';
import type { ApplicationFull } from '../types/loan';

interface UseApplicationReturn {
  data: ApplicationFull | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * @param id  Application UUID. Pass undefined/null to skip fetching.
 * @param mode 'analyst' uses the enriched analyst endpoint; 'standard' uses the normal one.
 */
export function useApplication(
  id: string | undefined | null,
  mode: 'analyst' | 'standard' = 'standard',
): UseApplicationReturn {
  const [data, setData]       = useState<ApplicationFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const fetch = mode === 'analyst'
      ? loanService.getAnalystApplication(id)
      : loanService.getApplication(id);

    fetch
      .then(setData)
      .catch(() => setError('Failed to load application.'))
      .finally(() => setLoading(false));
  }, [id, mode, tick]);

  function refetch() {
    setTick(t => t + 1);
  }

  return { data, loading, error, refetch };
}
