import type { Student } from '../types';
import { SEED_STUDENTS } from './seedData';

/** In-memory demo roster when Firestore has no students (stable ids for UI pickers). */
export function getDemoClassStudents(addedBy: string): Student[] {
  return SEED_STUDENTS.map((s, i) => ({
    ...s,
    id: `demo-${i}`,
    addedBy,
    createdAt: new Date().toISOString(),
  })) as Student[];
}

export function isDemoStudentId(id: string | undefined): boolean {
  return !!id && id.startsWith('demo-');
}
