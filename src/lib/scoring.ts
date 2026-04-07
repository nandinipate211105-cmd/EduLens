import type { Student, TopicMastery } from '../types';

export type MasteryLabel = TopicMastery['label'];
export type RiskLevel = Student['riskLevel'];

export function masteryLabel(masteryScore0to100: number): MasteryLabel {
  if (masteryScore0to100 >= 80) return 'Mastered';
  if (masteryScore0to100 >= 55) return 'Developing';
  return 'Needs Work';
}

export function computeRisk(score0to100: number, attendance0to100: number, assignments0to100: number): {
  riskLevel: RiskLevel;
  riskScore: number;
} {
  const marksTrend = (100 - score0to100) * 0.4;
  const attComponent = (100 - attendance0to100) * 0.35;
  const assignComponent = (100 - assignments0to100) * 0.25;
  const risk = marksTrend + attComponent + assignComponent;

  if (risk >= 55) return { riskLevel: 'HIGH', riskScore: Math.round(risk) };
  if (risk >= 35) return { riskLevel: 'MED', riskScore: Math.round(risk) };
  return { riskLevel: 'LOW', riskScore: Math.round(risk) };
}

export function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function withComputedRisk<T extends Pick<Student, 'score' | 'attendance' | 'assignments'>>(s: T) {
  const score = clampPct(s.score);
  const attendance = clampPct(s.attendance);
  const assignments = clampPct(s.assignments);
  const { riskLevel, riskScore } = computeRisk(score, attendance, assignments);
  return { ...s, score, attendance, assignments, riskLevel, riskScore };
}

