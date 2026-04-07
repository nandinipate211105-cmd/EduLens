import type { Student } from '../types';
import { clampPct } from './scoring';

function genCurveFromScore(base: number): number[] {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const drift = (i - 2) * 2;
    const noise = Math.floor(Math.random() * 9) - 4;
    return clampPct(base + drift + noise);
  });
  return pts.map((v, i) => {
    const a = pts[i - 1] ?? v;
    const b = v;
    const c = pts[i + 1] ?? v;
    return clampPct(Math.round((a + b * 2 + c) / 4));
  });
}

export type PerformanceCurvePoint = { label: string; score: number; classAvg: number };

/** Score % over recent tests, or a demo curve from overall score when history is thin. */
export function getStudentPerformanceCurve(student: Student | null | undefined): PerformanceCurvePoint[] {
  if (!student) return [];
  const history = (student.testHistory || [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);

  if (history.length >= 3) {
    return history.map((t, i) => ({
      label: t.testId?.includes('-T') ? t.testId.split('-').slice(-1)[0] : `T${i + 1}`,
      score: clampPct(Math.round((t.score / Math.max(1, t.maxScore)) * 100)),
      classAvg: (student.subjectScores || []).find(s => s.subject === t.subject)?.classAvg ?? 68,
    }));
  }

  const curve = genCurveFromScore(student.score ?? 60);
  return curve.map((score, i) => ({ label: `T${i + 1}`, score, classAvg: 68 }));
}
