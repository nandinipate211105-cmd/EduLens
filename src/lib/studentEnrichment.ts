import type { Student, SubjectScore, TestResult, TopicMastery } from '../types';
import { SUBJECTS, TOPIC_MAP } from './seedData';
import { masteryLabel, clampPct, computeRisk } from './scoring';

/** Deterministic pseudo-random 0..1 from string (stable across renders). */
function hash01(key: string, salt: number): number {
  let h = 2166136261;
  const s = `${key}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function syntheticTopicMastery(studentKey: string, baseScore: number): TopicMastery[] {
  const topics: TopicMastery[] = [];
  let idx = 0;
  SUBJECTS.forEach(sub => {
    (TOPIC_MAP[sub] || []).forEach(topic => {
      const noise = Math.round((hash01(studentKey, idx++) - 0.5) * 34);
      const mastery = clampPct(baseScore + noise);
      const label = masteryLabel(mastery);
      topics.push({
        subject: sub,
        topic,
        mastery,
        label,
        errorPattern: label === 'Needs Work' ? `Patterns to fix in ${topic.toLowerCase()}` : undefined,
      });
    });
  });
  return topics;
}

function syntheticSubjectScores(studentKey: string, baseScore: number): SubjectScore[] {
  return SUBJECTS.map((sub, si) => {
    const jitter = Math.round((hash01(studentKey, 200 + si) - 0.5) * 24);
    const score = clampPct(baseScore + jitter);
    const classAvg = clampPct(68 + Math.round((hash01(studentKey, 300 + si) - 0.5) * 12));
    return {
      subject: sub,
      score,
      classAvg,
      trend: [score, score - 3, score + 2, score - 1].map(clampPct),
    };
  });
}

function syntheticTestHistory(name: string, studentKey: string): TestResult[] {
  const results: TestResult[] = [];
  SUBJECTS.slice(0, 4).forEach((sub, si) => {
    for (let t = 1; t <= 3; t++) {
      const h = hash01(studentKey, 500 + si * 10 + t);
      const raw = Math.floor(40 + h * 55);
      results.push({
        testId: `${name}-${sub}-T${t}`,
        subject: sub,
        date: `2024-0${3 + si}-${10 + t * 5}`,
        score: raw,
        maxScore: 100,
        topics: (TOPIC_MAP[sub] || []).slice(0,2),
      });
    }
  });
  return results;
}

/** Fills missing topicMastery, testHistory, subjectScores so charts & gaps always have data. */
export function fillMissingStudentFields(s: Student): Student {
  const key = `${s.id || ''}|${s.name}`;
  const base = clampPct(s.score ?? 60);
  const next: Student = { ...s };

  if (!next.topicMastery?.length) {
    next.topicMastery = syntheticTopicMastery(key, base);
  }
  if (!next.subjectScores?.length) {
    next.subjectScores = syntheticSubjectScores(key, base);
  }
  if (!next.testHistory?.length) {
    next.testHistory = syntheticTestHistory(s.name || 'Student', key);
  }
  if (next.riskLevel == null || next.riskScore == null) {
    const att = clampPct(next.attendance ?? 80);
    const asn = clampPct(next.assignments ?? 80);
    const { riskLevel, riskScore } = computeRisk(base, att, asn);
    next.riskLevel = riskLevel;
    next.riskScore = riskScore;
  }
  return next;
}
