import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { UserProfile } from '../types';
import { SEED_STUDENTS } from '../lib/seedData';
import { TrendingUp, BookOpen, Calendar, ClipboardList } from 'lucide-react';

interface Props { user: UserProfile; }

// Use first high-risk student as demo student profile
const DEMO = SEED_STUDENTS[0]; // Arjun Mehta

export default function StudentDashboard({ user }: Props) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  useEffect(() => { const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000); return () => clearInterval(t); }, []);

  const scoreHistory = (DEMO.testHistory || []).filter(t => t.subject === 'Math').map(t => ({ test: `${t.subject} T${t.testId.slice(-1)}`, score: t.score }));

  const radarData = (DEMO.subjectScores || []).map(s => ({ subject: s.subject, score: s.score, fullMark: 100 }));

  const kpis = [
    { label: 'Overall Score', value: `${DEMO.score}%`, icon: TrendingUp, color: DEMO.score >= 70 ? 'text-[#34d399]' : DEMO.score >= 50 ? 'text-[#fbbf24]' : 'text-[#f87171]' },
    { label: 'Attendance', value: `${DEMO.attendance}%`, icon: Calendar, color: DEMO.attendance >= 80 ? 'text-[#34d399]' : 'text-[#f87171]' },
    { label: 'Assignments Done', value: `${DEMO.assignments}%`, icon: ClipboardList, color: 'text-white' },
    { label: 'Risk Level', value: DEMO.riskLevel, icon: BookOpen, color: DEMO.riskLevel === 'HIGH' ? 'text-[#f87171]' : DEMO.riskLevel === 'MED' ? 'text-[#fbbf24]' : 'text-[#34d399]' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-syne text-3xl font-extrabold text-white">
            Hi, <span className="text-[#38bdf8]">{user.displayName}</span> 👋
          </h2>
          <p className="mt-1 font-instrument text-[#64748b]">Here's your learning overview for today.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0f1a2e] px-4 py-2 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Current Time</p>
          <p className="font-syne text-sm font-bold text-white">{time}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-5">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={16} className="text-[#64748b]" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{kpi.label}</p>
            </div>
            <p className={`font-syne text-2xl font-extrabold ${kpi.color}`}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
          <h3 className="mb-4 font-syne text-lg font-bold text-white">Score Trend (Math)</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="test" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                <Line type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={2.5} dot={{ fill: '#38bdf8', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
          <h3 className="mb-4 font-syne text-lg font-bold text-white">Subject Performance Radar</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={10} />
                <PolarRadiusAxis stroke="#64748b" fontSize={9} domain={[0, 100]} />
                <Radar name="Score" dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Weak Topics Quick View */}
      <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
        <h3 className="mb-4 font-syne text-lg font-bold text-white">Topics Needing Attention</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(DEMO.topicMastery || []).filter(t => t.label === 'Needs Work').slice(0, 6).map((t, i) => (
            <div key={i} className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/5 p-3">
              <p className="font-syne text-xs font-bold text-white">{t.subject}</p>
              <p className="font-instrument text-sm text-[#f87171]">{t.topic}</p>
              <div className="mt-2 h-1 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#f87171]" style={{ width: `${t.mastery}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-[#64748b]">{t.mastery}% mastery</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
