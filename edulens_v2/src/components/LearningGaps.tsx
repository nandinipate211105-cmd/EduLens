import { motion } from 'motion/react';
import { useState } from 'react';
import { SEED_STUDENTS, CLASS_SUBJECT_GAPS } from '../lib/seedData';
import { UserProfile, TopicMastery } from '../types';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface Props { user: UserProfile; isTeacher?: boolean; currentStudentId?: string; }

const MASTERY_COLOR: Record<string, string> = {
  Mastered: 'text-[#34d399]',
  Developing: 'text-[#fbbf24]',
  'Needs Work': 'text-[#f87171]',
};
const MASTERY_BG: Record<string, string> = {
  Mastered: 'bg-[#34d399]/10 border-[#34d399]/20',
  Developing: 'bg-[#fbbf24]/10 border-[#fbbf24]/20',
  'Needs Work': 'bg-[#f87171]/10 border-[#f87171]/20',
};
const MASTERY_BAR: Record<string, string> = {
  Mastered: 'bg-[#34d399]',
  Developing: 'bg-[#fbbf24]',
  'Needs Work': 'bg-[#f87171]',
};

function TopicCard({ t }: { t: TopicMastery }) {
  return (
    <div className={`rounded-xl border p-3 ${MASTERY_BG[t.label]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-instrument text-sm text-white">{t.topic}</span>
        <span className={`text-xs font-bold ${MASTERY_COLOR[t.label]}`}>{t.label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full transition-all duration-700 ${MASTERY_BAR[t.label]}`} style={{ width: `${t.mastery}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[#64748b]">{t.mastery}% mastery</span>
        {t.errorPattern && <span className="text-[10px] text-[#f87171]">⚠ {t.errorPattern.slice(0, 30)}…</span>}
      </div>
    </div>
  );
}

export default function LearningGaps({ user, isTeacher = true, currentStudentId }: Props) {
  const [selectedStudent, setSelectedStudent] = useState(SEED_STUDENTS[0]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>('Math');
  const [view, setView] = useState<'class' | 'student'>('student');

  const student = isTeacher ? selectedStudent : (SEED_STUDENTS.find(s => s.name.includes('Arjun')) || SEED_STUDENTS[0]);
  const subjects = [...new Set((student.topicMastery || []).map(t => t.subject))];

  const aiSuggestions = (student.topicMastery || [])
    .filter(t => t.label === 'Needs Work')
    .slice(0, 3)
    .map(t => `Struggles in ${t.subject} → ${t.topic}: practice targeted exercises daily`);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Brain size={22} className="text-[#818cf8]" />
          <h2 className="font-syne text-3xl font-extrabold text-white">Learning <span className="text-[#38bdf8]">Gaps</span></h2>
        </div>
        <p className="font-instrument text-[#64748b]">Topic mastery map and AI-powered improvement suggestions</p>
      </div>

      {isTeacher && (
        <div className="flex flex-wrap gap-3">
          <div className="flex rounded-xl bg-[#0b1220] p-1 border border-white/10">
            {['student', 'class'].map(v => (
              <button key={v} onClick={() => setView(v as any)}
                className={`rounded-lg px-4 py-1.5 font-syne text-xs font-bold transition-all ${view === v ? 'bg-[#38bdf8] text-[#050a12]' : 'text-[#64748b]'}`}>
                {v === 'student' ? 'Per Student' : 'Class Overview'}
              </button>
            ))}
          </div>
          {view === 'student' && (
            <select onChange={e => { const s = SEED_STUDENTS.find(st => st.name === e.target.value); if (s) setSelectedStudent(s); }}
              className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2 text-sm text-white outline-none focus:border-[#38bdf8]">
              {SEED_STUDENTS.map(s => <option key={s.name}>{s.name}</option>)}
            </select>
          )}
        </div>
      )}

      {(!isTeacher || view === 'class') && (
        <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
          <h3 className="mb-4 font-syne text-lg font-bold text-white">Class-Level Weakness Map</h3>
          <div className="space-y-3">
            {CLASS_SUBJECT_GAPS.map((sg, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="w-32 font-instrument text-sm text-white">{sg.subject}</span>
                <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${sg.struggling > 35 ? 'bg-[#f87171]' : sg.struggling > 20 ? 'bg-[#fbbf24]' : 'bg-[#34d399]'}`}
                    style={{ width: `${(sg.struggling / 50) * 100}%` }} />
                </div>
                <span className="w-20 text-right text-sm font-bold text-white">{sg.struggling} students</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(view === 'student' || !isTeacher) && (
        <>
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-syne text-lg font-bold text-white">{student.name}</h3>
                <p className="text-xs text-[#64748b]">{student.grade} · Overall: {student.score}%</p>
              </div>
              <div className="flex gap-2">
                {(['Mastered', 'Developing', 'Needs Work'] as const).map(l => (
                  <span key={l} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${MASTERY_BG[l]} ${MASTERY_COLOR[l]}`}>{l}</span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {subjects.map(subject => {
                const topics = (student.topicMastery || []).filter(t => t.subject === subject);
                const isOpen = expandedSubject === subject;
                const avgMastery = Math.round(topics.reduce((a, t) => a + t.mastery, 0) / topics.length);
                const needsWork = topics.filter(t => t.label === 'Needs Work').length;
                return (
                  <div key={subject} className="rounded-xl border border-white/10 overflow-hidden">
                    <button onClick={() => setExpandedSubject(isOpen ? null : subject)}
                      className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/5">
                      <div className="flex items-center gap-3">
                        <span className="font-syne text-sm font-bold text-white">{subject}</span>
                        {needsWork > 0 && <span className="rounded-full bg-[#f87171]/10 px-2 py-0.5 text-[10px] font-bold text-[#f87171]">{needsWork} needs work</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full ${avgMastery >= 80 ? 'bg-[#34d399]' : avgMastery >= 55 ? 'bg-[#fbbf24]' : 'bg-[#f87171]'}`} style={{ width: `${avgMastery}%` }} />
                        </div>
                        <span className="text-xs text-[#64748b] w-8">{avgMastery}%</span>
                        {isOpen ? <ChevronUp size={16} className="text-[#64748b]" /> : <ChevronDown size={16} className="text-[#64748b]" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-white/5 p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {topics.map((t, ti) => <TopicCard key={ti} t={t} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="rounded-2xl border border-[#818cf8]/20 bg-[#0f1a2e] p-6">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={18} className="text-[#818cf8]" />
                <h3 className="font-syne text-lg font-bold text-white">AI Improvement Plan</h3>
              </div>
              <div className="space-y-2">
                {aiSuggestions.map((s, i) => (
                  <div key={i} className="flex gap-2 rounded-xl bg-[#818cf8]/5 border border-[#818cf8]/10 p-3">
                    <span className="text-[#818cf8] mt-0.5">→</span>
                    <p className="font-instrument text-sm text-[#94a3b8]">{s}</p>
                  </div>
                ))}
                <div className="flex gap-2 rounded-xl bg-[#38bdf8]/5 border border-[#38bdf8]/10 p-3">
                  <span className="text-[#38bdf8] mt-0.5">📅</span>
                  <p className="font-instrument text-sm text-[#94a3b8]">Recommended: 20 mixed problems/day · Re-test in 2 weeks · Consider peer-group study sessions</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
