import { useMemo } from 'react';
import type { ApplicationFull } from '../types/loan';

export interface ScoreBarItem {
  name: string;
  value: number;
}

export interface TrendDataItem {
  month: string;
  score: number | null;
}

export interface PieDataItem {
  name: string;
  value: number;
}

export interface ApplicationDetailCalculations {
  score: number | null;
  hasFraud: boolean;
  scoreBarData: ScoreBarItem[];
  trendData: TrendDataItem[];
  pieData: PieDataItem[];
}

export function useApplicationDetailData(detail: ApplicationFull | null): ApplicationDetailCalculations {
  return useMemo(() => {
    if (!detail) {
      return {
        score: null,
        hasFraud: false,
        scoreBarData: [],
        trendData: [],
        pieData: [],
      };
    }

    const { credit_score, fraud_flags, monthly_trend } = detail;
    const score = credit_score?.score ?? null;
    const hasFraud = fraud_flags.length > 0;

    const scoreBarData: ScoreBarItem[] = [
      { name: 'Income Stability', value: credit_score?.income_stability_score ?? 0 },
      { name: 'EMI Burden',       value: credit_score?.emi_burden_score ?? 0 },
      { name: 'Bounce Rate',      value: credit_score?.bounce_score ?? 0 },
      { name: 'Balance',          value: credit_score?.balance_score ?? 0 },
    ];

    const trendData: TrendDataItem[] = [...(monthly_trend || [])]
      .reverse()
      .map(p => ({ month: p.month?.slice(0, 7) ?? '', score: p.score }));

    const breakdownRaw = credit_score?.score_breakdown_json as Record<string, unknown> | null;
    const pieData: PieDataItem[] = breakdownRaw
      ? Object.entries(breakdownRaw)
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .map(([k, v]) => ({ name: k.replaceAll('_', ' '), value: Number(v) }))
      : [];

    return {
      score,
      hasFraud,
      scoreBarData,
      trendData,
      pieData,
    };
  }, [detail]);
}
