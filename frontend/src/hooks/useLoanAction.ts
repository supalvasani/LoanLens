// ─────────────────────────────────────────────────────────────────────────────
// useLoanAction — approve / reject / escalate mutation with loading + error state
// Used by both InlineActions (Queue) and the full decision panel (ApplicationDetail)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { loanService } from '../services/loanService';
import type { DecisionType } from '../types/loan';

type ActionMode = DecisionType | 'escalated';

interface UseLoanActionReturn {
  submitting: boolean;
  error: string | null;
  clearError: () => void;
  /** Submit analyst approve/reject/escalate. Returns true on success. */
  submitAnalyst: (
    applicationId: string,
    mode: ActionMode,
    notes?: string,
  ) => Promise<boolean>;
  /** Submit manager approve/reject. Returns true on success. */
  submitManager: (
    applicationId: string,
    decision: DecisionType,
    notes: string,
  ) => Promise<boolean>;
}

export function useLoanAction(): UseLoanActionReturn {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  function clearError() {
    setError(null);
  }

  async function submitAnalyst(
    applicationId: string,
    mode: ActionMode,
    notes?: string,
  ): Promise<boolean> {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'escalated') {
        if (!notes || notes.trim().length < 10) {
          setError('Escalation note must be at least 10 characters.');
          return false;
        }
        await loanService.escalate(applicationId, notes);
      } else {
        await loanService.decideAnalyst(applicationId, mode as DecisionType, notes || undefined);
      }
      return true;
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Action failed. Check escalation rules.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitManager(
    applicationId: string,
    decision: DecisionType,
    notes: string,
  ): Promise<boolean> {
    setSubmitting(true);
    setError(null);
    try {
      await loanService.decideManager(applicationId, decision, notes);
      return true;
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Failed to submit decision.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, error, clearError, submitAnalyst, submitManager };
}
