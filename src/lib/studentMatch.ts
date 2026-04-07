import type { Student, UserProfile } from '../types';

export function studentDataRichness(s: Student): number {
  return (s.topicMastery?.length || 0) + (s.testHistory?.length || 0) + (s.subjectScores?.length || 0);
}

/** Resolve the Firestore student row for the signed-in student user. */
export function pickStudentRecord(user: UserProfile, students: Student[]): Student | null {
  if (!students.length) return null;

  const dn = (user.displayName || '').trim().toLowerCase();
  const tokens = dn.split(/\s+/).filter(Boolean);
  const first = tokens[0] || '';
  const emailLocal = (user.email || '').split('@')[0]?.replace(/[._+]/g, ' ').trim().toLowerCase() || '';

  const byExact = students.find(s => s.name.trim().toLowerCase() === dn);
  if (byExact) return byExact;

  if (dn.length >= 3) {
    const byDn = students.find(s => s.name.toLowerCase().includes(dn));
    if (byDn) return byDn;
  }

  if (first.length >= 2) {
    const byFirst = students.find(s => {
      const parts = s.name.toLowerCase().split(/\s+/).filter(Boolean);
      return parts.some(p => p === first || (first.length >= 3 && p.startsWith(first)));
    });
    if (byFirst) return byFirst;
  }

  if (emailLocal.length >= 2) {
    const emailFirst = emailLocal.split(/\s+/)[0];
    const compact = (n: string) => n.toLowerCase().replace(/\s+/g, '');
    const byEmail = students.find(s => {
      const lower = s.name.toLowerCase();
      return (
        (emailFirst.length >= 2 && lower.includes(emailFirst)) ||
        (emailLocal.length >= 4 && compact(s.name).includes(compact(emailLocal)))
      );
    });
    if (byEmail) return byEmail;
  }

  if (students.length === 1) return students[0];

  const sorted = [...students].sort((a, b) => studentDataRichness(b) - studentDataRichness(a));
  return sorted[0] ?? null;
}
