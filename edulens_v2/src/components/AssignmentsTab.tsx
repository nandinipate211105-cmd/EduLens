import { motion } from 'motion/react';
import { ClipboardList, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

const ASSIGNMENTS = [
  { id: '1', title: 'Algebra Practice Set 3', subject: 'Math', dueDate: 'Apr 10', status: 'pending' as const },
  { id: '2', title: 'Essay: Industrial Revolution', subject: 'History', dueDate: 'Apr 8', status: 'submitted' as const },
  { id: '3', title: 'Newton\'s Laws Problem Set', subject: 'Physics', dueDate: 'Apr 5', status: 'late' as const, grade: 60 },
  { id: '4', title: 'Cell Biology Worksheet', subject: 'Science', dueDate: 'Apr 3', status: 'graded' as const, grade: 78 },
  { id: '5', title: 'Trigonometry Review', subject: 'Math', dueDate: 'Apr 12', status: 'pending' as const },
  { id: '6', title: 'OOP Concepts Assignment', subject: 'CS', dueDate: 'Apr 1', status: 'graded' as const, grade: 85 },
  { id: '7', title: 'English Grammar Exercises', subject: 'English', dueDate: 'Apr 9', status: 'pending' as const },
  { id: '8', title: 'Chemical Equations Lab Report', subject: 'Science', dueDate: 'Apr 6', status: 'submitted' as const },
];

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/10 border-[#fbbf24]/20' },
  submitted: { label: 'Submitted', icon: CheckCircle, color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10 border-[#38bdf8]/20' },
  late: { label: 'Late', icon: AlertCircle, color: 'text-[#f87171]', bg: 'bg-[#f87171]/10 border-[#f87171]/20' },
  graded: { label: 'Graded', icon: CheckCircle, color: 'text-[#34d399]', bg: 'bg-[#34d399]/10 border-[#34d399]/20' },
};

export default function AssignmentsTab() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'late' | 'graded'>('all');
  const filtered = ASSIGNMENTS.filter(a => filter === 'all' || a.status === filter);
  const counts = { pending: ASSIGNMENTS.filter(a => a.status === 'pending').length, submitted: ASSIGNMENTS.filter(a => a.status === 'submitted').length, late: ASSIGNMENTS.filter(a => a.status === 'late').length, graded: ASSIGNMENTS.filter(a => a.status === 'graded').length };
  const completion = Math.round(((counts.submitted + counts.graded) / ASSIGNMENTS.length) * 100);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardList size={22} className="text-[#818cf8]" />
        <h2 className="font-syne text-3xl font-extrabold text-white">My <span className="text-[#38bdf8]">Assignments</span></h2>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Pending', value: counts.pending, color: 'text-[#fbbf24]' },
          { label: 'Submitted', value: counts.submitted, color: 'text-[#38bdf8]' },
          { label: 'Late', value: counts.late, color: 'text-[#f87171]' },
          { label: 'Completion', value: `${completion}%`, color: 'text-[#34d399]' },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{k.label}</p>
            <p className={`mt-2 font-syne text-3xl font-extrabold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Completion bar */}
      <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-4">
        <div className="flex justify-between mb-2">
          <span className="font-syne text-sm font-bold text-white">Overall Completion</span>
          <span className="font-syne text-sm font-bold text-[#34d399]">{completion}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#38bdf8] to-[#34d399] transition-all duration-700" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'submitted', 'late', 'graded'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-xl px-3 py-1.5 font-syne text-xs font-bold transition-all capitalize ${filter === f ? 'bg-[#38bdf8] text-[#050a12]' : 'border border-white/10 text-[#64748b] hover:text-white'}`}>
            {f} {f !== 'all' && `(${counts[f as keyof typeof counts] || 0})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(a => {
          const cfg = STATUS_CONFIG[a.status];
          const Icon = cfg.icon;
          return (
            <div key={a.id} className={`rounded-2xl border p-4 ${cfg.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-syne text-sm font-bold text-white">{a.title}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#64748b]">{a.subject}</span>
                  </div>
                  <p className="text-xs text-[#64748b]">Due: {a.dueDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  {a.grade !== undefined && <span className="font-syne font-bold text-white">{a.grade}%</span>}
                  <div className={`flex items-center gap-1 ${cfg.color}`}>
                    <Icon size={16} />
                    <span className="text-xs font-bold">{cfg.label}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
