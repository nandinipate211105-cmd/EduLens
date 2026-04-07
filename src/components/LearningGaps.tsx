import { motion } from 'motion/react';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line } from 'recharts';
import { CLASS_SUBJECT_GAPS, SUBJECTS, TOPIC_MAP } from '../lib/seedData';
import { UserProfile, TopicMastery, Student } from '../types';
import { Brain, ChevronDown, ChevronUp, Loader, BookOpen, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';
import { addStudent, subscribeStudents } from '../lib/firebaseService';
import { clampPct, masteryLabel, withComputedRisk } from '../lib/scoring';
import { pickStudentRecord } from '../lib/studentMatch';
import { getStudentPerformanceCurve } from '../lib/studentCurve';
import { getDemoClassStudents } from '../lib/demoClassData';
import { fillMissingStudentFields } from '../lib/studentEnrichment';
import { generateStudentLearningGapAdvice, isGeminiConfigured } from '../lib/gemini';

interface Props { user: UserProfile; isTeacher?: boolean; }

const MASTERY_COLOR: Record<string, string> = {
  Mastered: 'text-[#34d399]', Developing: 'text-[#fbbf24]', 'Needs Work': 'text-[#f87171]',
};
const MASTERY_BG: Record<string, string> = {
  Mastered: 'bg-[#34d399]/10 border-[#34d399]/20',
  Developing: 'bg-[#fbbf24]/10 border-[#fbbf24]/20',
  'Needs Work': 'bg-[#f87171]/10 border-[#f87171]/20',
};
const MASTERY_BAR: Record<string, string> = {
  Mastered: 'bg-[#34d399]', Developing: 'bg-[#fbbf24]', 'Needs Work': 'bg-[#f87171]',
};

function TopicCard({ t }: { t: TopicMastery }) {
  const label: TopicMastery['label'] =
    t.label && t.label in MASTERY_BG ? t.label : masteryLabel(typeof t.mastery === 'number' ? t.mastery : 0);
  return (
    <div className={`rounded-xl border p-3 ${MASTERY_BG[label]}`}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="font-instrument text-sm text-white truncate">{t.topic}</span>
        <span className={`text-[10px] font-bold flex-shrink-0 ${MASTERY_COLOR[label]}`}>{label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full transition-all duration-700 ${MASTERY_BAR[label]}`} style={{ width: `${clampPct(t.mastery ?? 0)}%` }} />
      </div>
      <div className="flex justify-between mt-1 gap-2">
        <span className="text-[10px] text-[#64748b]">{clampPct(t.mastery ?? 0)}% mastery</span>
        {t.errorPattern && <span className="text-[10px] text-[#f87171] truncate max-w-[120px]">⚠ {t.errorPattern.slice(0, 25)}…</span>}
      </div>
    </div>
  );
}

function genDummyTopicMastery(baseScore: number): TopicMastery[] {
  const topics: TopicMastery[] = [];
  SUBJECTS.forEach(sub => {
    (TOPIC_MAP[sub] || []).forEach(topic => {
      const variance = Math.floor(Math.random() * 35) - 17;
      const mastery = clampPct(baseScore + variance);
      const label = masteryLabel(mastery);
      topics.push({
        subject: sub,
        topic,
        mastery,
        label,
        errorPattern: label === 'Needs Work' ? `Repeated errors in ${topic.toLowerCase()} problems` : undefined,
      });
    });
  });
  return topics;
}

export default function LearningGaps({ user, isTeacher = true }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [expandedSubject, setExpandedSubject] = useState<string | null>('Math');
  const [view, setView] = useState<'class' | 'student'>('student');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>('');
  const [aiCoachText, setAiCoachText] = useState('');
  const [aiCoachLoading, setAiCoachLoading] = useState(false);
  const [aiCoachError, setAiCoachError] = useState('');
  const [form, setForm] = useState<{
    name: string;
    grade: string;
    score: number;
    attendance: number;
    assignments: number;
    topicMasteryMode: 'auto' | 'none';
  }>({
    name: '',
    grade: '10A',
    score: 65,
    attendance: 85,
    assignments: 80,
    topicMasteryMode: 'auto',
  });

  useEffect(() => {
    const unsub = subscribeStudents(data => {
      setStudents(data);
      if (data.length > 0) setSelectedId(prev => prev || data[0].id || '');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const usingDemoRoster = students.length === 0;
  const roster = useMemo(
    () => (usingDemoRoster ? getDemoClassStudents(user.uid) : students),
    [usingDemoRoster, user.uid, students]
  );

  useEffect(() => {
    if (!isTeacher || roster.length === 0) return;
    setSelectedId(prev =>
      prev && roster.some(s => s.id === prev) ? prev : roster[0]?.id || ''
    );
  }, [isTeacher, roster]);

  const handleGenerateDummy = () => {
    const first = ['Arjun', 'Sara', 'Dev', 'Nisha', 'Rohit', 'Priya', 'Aditya', 'Meera', 'Vikram', 'Anjali', 'Sanjay', 'Pooja'][Math.floor(Math.random() * 12)];
    const last = ['Mehta', 'Kapoor', 'Patel', 'Reddy', 'Singh', 'Sharma', 'Kumar', 'Nair', 'Rao', 'Gupta', 'Joshi', 'Verma'][Math.floor(Math.random() * 12)];
    const grade = ['10A', '10B', '11A', '11B', '12A', '12B'][Math.floor(Math.random() * 6)];
    const score = Math.floor(35 + Math.random() * 60);
    const attendance = Math.floor(50 + Math.random() * 50);
    const assignments = Math.floor(45 + Math.random() * 55);
    setForm(f => ({
      ...f,
      name: `${first} ${last}`,
      grade,
      score,
      attendance,
      assignments,
      topicMasteryMode: 'auto',
    }));
    setSaveMsg('');
  };

  const handleSaveStudent = async () => {
    if (saving) return;
    setSaveMsg('');
    const name = form.name.trim();
    if (!name) {
      setSaveMsg('Please enter a student name.');
      return;
    }

    setSaving(true);
    try {
      const base = withComputedRisk({
        name,
        grade: form.grade.trim() || '10A',
        score: form.score,
        attendance: form.attendance,
        assignments: form.assignments,
      });

      const topicMastery =
        form.topicMasteryMode === 'auto'
          ? genDummyTopicMastery(base.score)
          : [];

      const created = await addStudent({
        name: base.name,
        grade: base.grade,
        score: base.score,
        attendance: base.attendance,
        assignments: base.assignments,
        riskLevel: base.riskLevel,
        riskScore: base.riskScore,
        topicMastery,
        addedBy: user.uid,
        createdAt: new Date().toISOString(),
      } as any);

      // Ensure UI updates immediately: select the newly created student
      if (created?.id) {
        setSelectedId(created.id);
        setView('student');
        setExpandedSubject('Math');
      }
      setShowAdd(false);
      setForm(f => ({ ...f, name: '' }));
      setSaveMsg('Saved.');
    } catch (e: any) {
      setSaveMsg(e?.message ? `Error: ${e.message}` : 'Error saving student.');
    } finally {
      setSaving(false);
    }
  };

  const myStudent = !isTeacher ? pickStudentRecord(user, roster) : null;

  const selectedStudentRaw = isTeacher
    ? roster.find(s => s.id === selectedId) || roster[0]
    : myStudent;

  const selectedStudent = useMemo(
    () => (selectedStudentRaw ? fillMissingStudentFields(selectedStudentRaw) : null),
    [selectedStudentRaw]
  );

  const adviceCacheKey = selectedStudent?.id || selectedStudent?.name || '';
  useEffect(() => {
    setAiCoachText('');
    setAiCoachError('');
  }, [adviceCacheKey]);

  const fetchAiCoachAdvice = async () => {
    if (!selectedStudent) return;
    setAiCoachLoading(true);
    setAiCoachError('');
    try {
      const weakTopics = (selectedStudent.topicMastery || []).filter(t => t.label === 'Needs Work');
      const text = await generateStudentLearningGapAdvice({
        name: selectedStudent.name,
        grade: selectedStudent.grade,
        score: selectedStudent.score,
        attendance: selectedStudent.attendance,
        assignments: selectedStudent.assignments,
        riskLevel: selectedStudent.riskLevel,
        weakTopics: weakTopics.map(t => ({
          subject: t.subject,
          topic: t.topic,
          mastery: clampPct(t.mastery ?? 0),
          errorPattern: t.errorPattern,
        })),
      });
      setAiCoachText(text);
    } catch (e: any) {
      setAiCoachError(e?.message || 'Could not load AI advice.');
    } finally {
      setAiCoachLoading(false);
    }
  };

  const studentCurveData = useMemo(
    () => getStudentPerformanceCurve(selectedStudent),
    [selectedStudent]
  );

  const topicMastery: TopicMastery[] = selectedStudent?.topicMastery || [];
  const subjects = [...new Set(topicMastery.map(t => t.subject))];

  const weakTopicsList = topicMastery.filter(t => t.label === 'Needs Work');

  const topicHighlights = weakTopicsList.slice(0, 4).map(
    t => `Struggles in **${t.subject}** → **${t.topic}** (${clampPct(t.mastery ?? 0)}%): ${t.errorPattern || 'schedule targeted practice'}`
  );

  // Summary stats
  const masteredCount   = topicMastery.filter(t => t.label === 'Mastered').length;
  const developingCount = topicMastery.filter(t => t.label === 'Developing').length;
  const needsWorkCount  = topicMastery.filter(t => t.label === 'Needs Work').length;

  const enrichedRoster = useMemo(() => roster.map(s => fillMissingStudentFields(s)), [roster]);

  const classGapData = CLASS_SUBJECT_GAPS.map(g => ({
    ...g,
    liveStruggling:
      roster.length === 0
        ? g.struggling
        : enrichedRoster.filter(s =>
            (s.topicMastery || []).some(t => t.subject === g.subject && t.label === 'Needs Work')
          ).length,
  }));

  const allTopics = enrichedRoster.flatMap(s => s.topicMastery || []);
  const labelCounts = {
    Mastered: allTopics.filter(t => t.label === 'Mastered').length,
    Developing: allTopics.filter(t => t.label === 'Developing').length,
    'Needs Work': allTopics.filter(t => t.label === 'Needs Work').length,
  };
  const masteryDist = [
    { name: 'Mastered', value: labelCounts.Mastered, fill: '#34d399' },
    { name: 'Developing', value: labelCounts.Developing, fill: '#fbbf24' },
    { name: 'Needs Work', value: labelCounts['Needs Work'], fill: '#f87171' },
  ];
  const masteryPieTotal =
    labelCounts.Mastered + labelCounts.Developing + labelCounts['Needs Work'];

  const weakTopicCounts = allTopics
    .filter(t => t.label === 'Needs Work')
    .reduce<Record<string, { topic: string; subject: string; count: number }>>((acc, t) => {
      const key = `${t.subject}::${t.topic}`;
      acc[key] = acc[key] || { topic: t.topic, subject: t.subject, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {});
  const topWeakTopics = Object.values(weakTopicCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const riskCounts = {
    HIGH: enrichedRoster.filter(s => s.riskLevel === 'HIGH').length,
    MED: enrichedRoster.filter(s => s.riskLevel === 'MED').length,
    LOW: enrichedRoster.filter(s => s.riskLevel === 'LOW').length,
  };

  const aiQuickInsights = (() => {
    if (roster.length === 0) return [];
    const lowAtt = enrichedRoster.filter(s => (s.attendance || 0) < 75);
    const needsWorkAttLow = enrichedRoster.filter(s =>
      (s.attendance || 0) < 75 && (s.topicMastery || []).filter(t => t.label === 'Needs Work').length >= 4
    );
    const topGap = classGapData.slice().sort((a, b) => (b.liveStruggling || 0) - (a.liveStruggling || 0))[0];
    const topWeak = topWeakTopics[0];

    const bullets: string[] = [];
    if (topGap) bullets.push(`Highest subject gap: ${topGap.subject} — ${topGap.liveStruggling} students flagged as “Needs Work”`);
    if (topWeak) bullets.push(`Most common weak topic: ${topWeak.subject} → ${topWeak.topic} (${topWeak.count} students)`);
    bullets.push(`${riskCounts.HIGH} high-risk, ${riskCounts.MED} medium-risk students — prioritize interventions for the top group first`);
    if (lowAtt.length > 0) bullets.push(`${lowAtt.length} students below 75% attendance — attendance recovery plan recommended`);
    if (needsWorkAttLow.length > 0) bullets.push(`${needsWorkAttLow.length} students show low mastery + low attendance — schedule 1:1 + parent outreach`);
    bullets.push(`Peer grouping idea: pair “Mastered” students with “Needs Work” students for top weak topics this week`);
    return bullets.slice(0, 6);
  })();

  // Heatmap-ish matrix: subject -> topic -> % Needs Work
  const heatmapRows = SUBJECTS.map(sub => {
    const topics = TOPIC_MAP[sub] || [];
    const cells = topics.map(topic => {
      const relevant = enrichedRoster.filter(s => (s.topicMastery || []).some(t => t.subject === sub && t.topic === topic));
      const denom = Math.max(relevant.length, 1);
      const needs = enrichedRoster.filter(s => (s.topicMastery || []).some(t => t.subject === sub && t.topic === topic && t.label === 'Needs Work')).length;
      const pct = Math.round((needs / denom) * 100);
      return { subject: sub, topic, needs, denom, pct };
    });
    return { subject: sub, cells };
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Brain size={22} className="text-[#818cf8]" />
          <h2 className="font-syne text-3xl font-extrabold text-white">Learning <span className="text-[#38bdf8]">Gaps</span></h2>
        </div>
        <p className="font-instrument text-[#64748b]">Topic mastery map and AI-powered improvement suggestions — synced live from Firebase.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size={28} className="animate-spin text-[#38bdf8]" />
        </div>
      ) : roster.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-12 text-center">
          <Brain size={40} className="mx-auto mb-4 text-[#64748b]" />
          <p className="font-syne text-white font-bold">No student data yet</p>
          <p className="font-instrument text-sm text-[#64748b] mt-1">Go to the Dashboard and click "Seed Demo Data" to populate.</p>
        </div>
      ) : (
        <>
          {usingDemoRoster && (
            <div className="rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-3 font-instrument text-sm text-[#fbbf24]">
              <span className="font-syne font-bold text-white">Demo class data: </span>
              Firestore has no students yet — showing 12 sample profiles so charts and learning gaps work. Use <strong>Seed Demo Data</strong> on the Dashboard or add students for live Firebase data.
            </div>
          )}
          {/* Teacher: view toggle + student picker */}
          {isTeacher && (
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex rounded-xl bg-[#0b1220] p-1 border border-white/10">
                {['student', 'class'].map(v => (
                  <button key={v} onClick={() => setView(v as any)}
                    className={`rounded-lg px-4 py-1.5 font-syne text-xs font-bold transition-all capitalize ${view === v ? 'bg-[#38bdf8] text-[#050a12]' : 'text-[#64748b] hover:text-white'}`}>
                    {v === 'student' ? 'Per Student' : 'Class Overview'}
                  </button>
                ))}
              </div>
              {view === 'student' && (
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2 text-sm text-white outline-none focus:border-[#38bdf8]">
                  {roster.map((s, i) => (
                    <option key={s.id || `s-${i}`} value={s.id || ''}>{s.name} — {s.grade}</option>
                  ))}
                </select>
              )}

              <button
                onClick={() => { setShowAdd(true); setSaveMsg(''); }}
                className="ml-auto rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-4 py-2 font-syne text-xs font-bold text-[#38bdf8] hover:bg-[#38bdf8]/20 transition-all"
              >
                + Add Student
              </button>
            </div>
          )}

          {/* Add Student Modal */}
          {isTeacher && showAdd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => (!saving ? setShowAdd(false) : null)}
              />
              <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-syne text-lg font-bold text-white">Add Student (Manual / Dummy)</h3>
                  <button
                    onClick={() => setShowAdd(false)}
                    disabled={saving}
                    className="rounded-lg px-3 py-1 text-xs font-bold text-[#94a3b8] hover:text-white disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Name</span>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g., Riya Sharma"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2 text-sm text-white outline-none focus:border-[#38bdf8]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Grade / Section</span>
                    <input
                      value={form.grade}
                      onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2 text-sm text-white outline-none focus:border-[#38bdf8]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Score (%)</span>
                    <input
                      type="number"
                      value={form.score}
                      onChange={e => setForm(f => ({ ...f, score: Number(e.target.value) }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2 text-sm text-white outline-none focus:border-[#38bdf8]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Attendance (%)</span>
                    <input
                      type="number"
                      value={form.attendance}
                      onChange={e => setForm(f => ({ ...f, attendance: Number(e.target.value) }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2 text-sm text-white outline-none focus:border-[#38bdf8]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Assignments (%)</span>
                    <input
                      type="number"
                      value={form.assignments}
                      onChange={e => setForm(f => ({ ...f, assignments: Number(e.target.value) }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2 text-sm text-white outline-none focus:border-[#38bdf8]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Topic Mastery</span>
                    <select
                      value={form.topicMasteryMode}
                      onChange={e => setForm(f => ({ ...f, topicMasteryMode: e.target.value as any }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2 text-sm text-white outline-none focus:border-[#38bdf8]"
                    >
                      <option value="auto">Auto-generate (recommended)</option>
                      <option value="none">No topic mastery</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleGenerateDummy}
                    disabled={saving}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-syne text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    Generate Dummy Student
                  </button>
                  <button
                    onClick={handleSaveStudent}
                    disabled={saving}
                    className="rounded-xl border border-[#34d399]/30 bg-[#34d399]/10 px-4 py-2 font-syne text-xs font-bold text-[#34d399] hover:bg-[#34d399]/20 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Student'}
                  </button>
                  {saveMsg && (
                    <span className="text-xs text-[#94a3b8]">{saveMsg}</span>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1">What teachers get</p>
                  <p className="text-xs text-[#94a3b8]">
                    Risk level is computed from Score/Attendance/Assignments. If topic mastery is auto-generated, your
                    class charts + AI suggestions update instantly for this student.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── CLASS OVERVIEW ── */}
          {isTeacher && view === 'class' && (
            <div className="space-y-6">
              {/* AI quick insights (derived from live data) */}
              <div className="rounded-2xl border border-[#818cf8]/20 bg-[#0f1a2e] p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={18} className="text-[#818cf8]" />
                  <h3 className="font-syne text-lg font-bold text-white">AI Quick Insights</h3>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#34d399] border border-[#34d399]/30 rounded-full px-2 py-0.5">Live</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {aiQuickInsights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/5 p-3">
                      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#818cf8]" />
                      <p className="font-instrument text-sm text-[#94a3b8]">{ins}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mastery distribution + Top weak topics */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6 lg:col-span-1">
                  <h3 className="mb-4 font-syne text-lg font-bold text-white">Topic Mastery Distribution</h3>
                  <div className="h-[240px] touch-manipulation">
                    {masteryPieTotal === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <p className="font-instrument text-sm text-[#64748b]">No topic mastery entries yet.</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={masteryDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false}>
                            {masteryDist.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-[#64748b]">
                    Based on all topic mastery entries across all students.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6 lg:col-span-2">
                  <h3 className="mb-4 font-syne text-lg font-bold text-white">Top Weak Topics (Needs Work)</h3>
                  {topWeakTopics.length === 0 ? (
                    <p className="font-instrument text-sm text-[#64748b]">No weak topics detected yet.</p>
                  ) : (
                    <div className="h-[240px] touch-manipulation">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topWeakTopics} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                          <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis
                            type="category"
                            dataKey="topic"
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            width={140}
                          />
                          <Tooltip contentStyle={{ backgroundColor: '#0f1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                            formatter={(v: any) => [v, 'Students']} />
                          <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#f87171" fillOpacity={0.8} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Bar chart */}
              <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
                <h3 className="mb-4 font-syne text-lg font-bold text-white">Students Struggling per Subject</h3>
                <div className="h-[280px] touch-manipulation">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classGapData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="subject" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={90} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                        formatter={(val: any, name: string) => [val, name === 'liveStruggling' ? 'Students Struggling' : name]}
                      />
                      <Bar dataKey="liveStruggling" radius={[0, 6, 6, 0]} name="liveStruggling" isAnimationActive={false}>
                        {classGapData.map((_, i) => (
                          <Cell key={i} fill={i < 2 ? '#f87171' : i < 4 ? '#fbbf24' : '#34d399'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Subject cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {classGapData.map((gap, i) => {
                  const pct = Math.round((gap.liveStruggling / Math.max(roster.length, 1)) * 100);
                  const color = gap.liveStruggling > 5 ? '#f87171' : gap.liveStruggling > 3 ? '#fbbf24' : '#34d399';
                  return (
                    <div key={i} className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-syne text-sm font-bold text-white">{gap.subject}</p>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: color + '20', color }}>{pct}% at risk</span>
                      </div>
                      <p className="font-syne text-2xl font-extrabold mb-1" style={{ color }}>{gap.liveStruggling}</p>
                      <p className="text-xs text-[#64748b] mb-3">students struggling</p>
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Students needing most help */}
              <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
                <h3 className="mb-4 font-syne text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle size={18} className="text-[#f87171]" /> Students Needing Most Help
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {enrichedRoster
                    .map(s => ({
                      ...s,
                      needsWorkCount: (s.topicMastery || []).filter(t => t.label === 'Needs Work').length
                    }))
                    .sort((a, b) => b.needsWorkCount - a.needsWorkCount)
                    .slice(0, 6)
                    .map((s, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                        <div>
                          <p className="font-syne text-sm font-bold text-white">{s.name}</p>
                          <p className="text-xs text-[#64748b]">{s.grade} · {s.needsWorkCount} weak topics</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          s.riskLevel === 'HIGH' ? 'bg-[#f87171]/10 text-[#f87171]' :
                          s.riskLevel === 'MED' ? 'bg-[#fbbf24]/10 text-[#fbbf24]' :
                          'bg-[#34d399]/10 text-[#34d399]'}`}>{s.riskLevel}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Topic weakness heatmap */}
              <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
                <h3 className="mb-4 font-syne text-lg font-bold text-white">Topic Weakness Map (Needs Work %)</h3>
                <div className="space-y-4">
                  {heatmapRows.map(row => (
                    <div key={row.subject}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-syne text-sm font-bold text-white">{row.subject}</p>
                        <p className="text-xs text-[#64748b]">{(TOPIC_MAP[row.subject] || []).length} topics</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {row.cells.map(cell => {
                          const bg =
                            cell.pct >= 60 ? 'bg-[#f87171]/15 border-[#f87171]/25' :
                            cell.pct >= 35 ? 'bg-[#fbbf24]/15 border-[#fbbf24]/25' :
                            'bg-[#34d399]/10 border-[#34d399]/20';
                          const fg =
                            cell.pct >= 60 ? 'text-[#f87171]' :
                            cell.pct >= 35 ? 'text-[#fbbf24]' :
                            'text-[#34d399]';
                          return (
                            <div key={cell.topic} className={`rounded-xl border p-3 ${bg}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-instrument text-sm text-white truncate">{cell.topic}</p>
                                <span className={`text-[10px] font-bold ${fg}`}>{cell.pct}%</span>
                              </div>
                              <p className="mt-1 text-[10px] text-[#64748b]">
                                {cell.needs} / {cell.denom} students flagged
                              </p>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cell.pct}%`, backgroundColor: cell.pct >= 60 ? '#f87171' : cell.pct >= 35 ? '#fbbf24' : '#34d399' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PER STUDENT VIEW (teacher + student: KPIs, curve, AI, topics) ── */}
          {(!isTeacher || view === 'student') && (
            <div className="space-y-5">
              {!selectedStudent ? (
                <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-8 text-center">
                  <p className="font-syne text-white">No student selected.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Mastered', value: masteredCount, color: 'text-[#34d399]', bg: 'border-[#34d399]/20', icon: TrendingUp },
                      { label: 'Developing', value: developingCount, color: 'text-[#fbbf24]', bg: 'border-[#fbbf24]/20', icon: BookOpen },
                      { label: 'Needs Work', value: needsWorkCount, color: 'text-[#f87171]', bg: 'border-[#f87171]/20', icon: AlertTriangle },
                    ].map((k, i) => (
                      <div key={i} className={`rounded-2xl border ${k.bg} bg-[#0f1a2e] p-5`}>
                        <div className="flex items-center gap-2 mb-1">
                          <k.icon size={14} className={k.color} />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{k.label}</p>
                        </div>
                        <p className={`font-syne text-3xl font-extrabold ${k.color}`}>{k.value}</p>
                        <p className="text-[10px] text-[#64748b]">topics</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
                    <h3 className="mb-4 font-syne text-lg font-bold text-white">
                      Performance curve (score % over tests){!isTeacher ? ` — ${selectedStudent.name}` : ''}
                    </h3>
                    <div className="h-[240px] touch-manipulation">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={studentCurveData} margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                          <Line type="monotone" dataKey="classAvg" stroke="#64748b" strokeWidth={2} dot={false} name="Class avg" isAnimationActive={false} />
                          <Line type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} name={!isTeacher ? 'You' : 'Student'} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-3 text-xs text-[#64748b]">
                      Uses recent test history when available; otherwise a demo curve from overall score.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#f87171]/25 bg-[#0f1a2e] p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={18} className="text-[#f87171]" />
                      <h3 className="font-syne text-base font-bold text-white">Weak topics (Needs work)</h3>
                    </div>
                    {weakTopicsList.length === 0 ? (
                      <p className="font-instrument text-sm text-[#64748b]">No topics flagged as weak yet — great progress.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                              <th className="pb-2 pr-4">Subject</th>
                              <th className="pb-2 pr-4">Topic</th>
                              <th className="pb-2 pr-4">Mastery</th>
                              <th className="pb-2">Note</th>
                            </tr>
                          </thead>
                          <tbody className="font-instrument text-[#94a3b8]">
                            {weakTopicsList.map((t, i) => (
                              <tr key={`${t.subject}-${t.topic}-${i}`} className="border-b border-white/5 last:border-0">
                                <td className="py-2 pr-4 text-white">{t.subject}</td>
                                <td className="py-2 pr-4">{t.topic}</td>
                                <td className="py-2 pr-4 text-[#f87171] font-bold">{clampPct(t.mastery ?? 0)}%</td>
                                <td className="py-2 text-xs">{t.errorPattern || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {topicHighlights.length > 0 && (
                    <div className="rounded-2xl border border-[#818cf8]/20 bg-[#0f1a2e] p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain size={18} className="text-[#818cf8]" />
                        <h3 className="font-syne text-base font-bold text-white">
                          At-a-glance priorities {!isTeacher ? '' : `— ${selectedStudent.name}`}
                        </h3>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {topicHighlights.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/5 p-3">
                            <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#818cf8]" />
                            <p className="font-instrument text-sm text-[#94a3b8]">
                              {s.replace(/\*\*(.*?)\*\*/g, '$1')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-[#34d399]/25 bg-[#0f1a2e] p-6">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-[#34d399]" />
                        <h3 className="font-syne text-base font-bold text-white">AI study coach</h3>
                      </div>
                      <button
                        type="button"
                        onClick={fetchAiCoachAdvice}
                        disabled={aiCoachLoading || !selectedStudent}
                        className="rounded-xl bg-[#34d399]/20 border border-[#34d399]/40 px-4 py-2 font-syne text-xs font-bold text-[#34d399] hover:bg-[#34d399]/30 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {aiCoachLoading ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {aiCoachLoading ? 'Generating…' : aiCoachText ? 'Refresh advice' : 'Get AI advice'}
                      </button>
                      <span className="text-[10px] text-[#64748b]">
                        {isGeminiConfigured() ? 'Powered by Gemini' : 'Offline tips unless GEMINI_API_KEY is set in .env'}
                      </span>
                    </div>
                    {aiCoachError && <p className="text-sm text-[#f87171] mb-2">{aiCoachError}</p>}
                    {aiCoachText ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 font-instrument text-sm text-[#94a3b8] whitespace-pre-wrap">
                        {aiCoachText}
                      </div>
                    ) : (
                      <p className="font-instrument text-sm text-[#64748b]">
                        Click <strong>Get AI advice</strong> for a short study plan based on weak topics and scores{!isGeminiConfigured() ? ' (template mode without API key)' : ''}.
                      </p>
                    )}
                  </div>

                  {subjects.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-8 text-center">
                      <BookOpen size={32} className="mx-auto mb-3 text-[#64748b]" />
                      <p className="font-syne text-sm font-bold text-white">No topic mastery data yet</p>
                      <p className="font-instrument text-xs text-[#64748b] mt-1">Upload an answer sheet to auto-populate topic data.</p>
                    </div>
                  ) : (
                    subjects.map(sub => {
                      const topics = topicMastery.filter(t => t.subject === sub);
                      const isOpen = expandedSubject === sub;
                      const weakInSub = topics.filter(t => t.label === 'Needs Work').length;
                      return (
                        <div key={sub} className="rounded-2xl border border-white/10 bg-[#0f1a2e] overflow-hidden">
                          <button type="button" onClick={() => setExpandedSubject(isOpen ? null : sub)}
                            className="flex w-full items-center justify-between p-5 hover:bg-white/5 transition-all touch-manipulation">
                            <div className="flex items-center gap-3">
                              <span className="font-syne text-base font-bold text-white">{sub}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${weakInSub > 0 ? 'bg-[#f87171]/10 text-[#f87171]' : 'bg-[#34d399]/10 text-[#34d399]'}`}>
                                {weakInSub > 0 ? `${weakInSub} weak` : 'On track'}
                              </span>
                              <span className="text-xs text-[#64748b]">{topics.length} topics</span>
                            </div>
                            {isOpen
                              ? <ChevronUp size={16} className="text-[#64748b]" />
                              : <ChevronDown size={16} className="text-[#64748b]" />}
                          </button>
                          {isOpen && (
                            <div className="grid gap-2 p-5 pt-0 sm:grid-cols-2">
                              {topics.map((t, i) => <TopicCard key={i} t={t} />)}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
