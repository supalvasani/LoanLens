// ─────────────────────────────────────────────────────────────────────────────
// usePortalData — fetches all data the applicant portal dashboard needs
// Runs three requests in parallel and exposes individual loading states
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { loanService } from '../services/loanService';
import type { LoanApplication } from '../types/loan';
import type { CreditScoreData, EligibilityData } from '../services/loanService';

interface UsePortalDataReturn {
  apps: (LoanApplication & { primary_rejection_reason?: string | null })[];
  score: CreditScoreData | null;
  eligibility: EligibilityData | null;
  loading: boolean;
  refetch: () => void;
}

export function usePortalData(): UsePortalDataReturn {
  const [apps, setApps]           = useState<(LoanApplication & { primary_rejection_reason?: string | null })[]>([]);
  const [score, setScore]         = useState<CreditScoreData | null>(null);
  const [eligibility, setElig]    = useState<EligibilityData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tick, setTick]           = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      loanService.getMyApplications(),
      loanService.getMyCreditScore(),
      loanService.getMyEligibility(),
    ]).then(([appsResult, scoreResult, eligResult]) => {
      if (appsResult.status === 'fulfilled') setApps(appsResult.value);
      if (scoreResult.status === 'fulfilled') setScore(scoreResult.value);
      if (eligResult.status === 'fulfilled')  setElig(eligResult.value);
    }).finally(() => setLoading(false));
  }, [tick]);

  function refetch() {
    setTick(t => t + 1);
  }

  return { apps, score, eligibility, loading, refetch };
}
