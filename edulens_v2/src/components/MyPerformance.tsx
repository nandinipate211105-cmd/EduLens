import { motion } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend } from 'recharts';
import { SEED_STUDENTS, SUBJECTS } from '../lib/seedData';
import { TrendingUp } from 'lucide-react';

const DEMO = SEED_STUDENTS[0];

export default function MyPerformance() {
  const subjectData = (DEMO.subjectScores || []).map(s => ({
    subject: s.subject,
    myScore: s.score,
    classAvg: s.classAvg,
  }));

  const testTrend = (DEMO.testHistory || []).map(t => ({
    label: `${t.subject.slice(0,3)} T${t.testId.slice(-1)}`,
    score: t.score,
    subject: t.subject,
  }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp size={22} className="text-[#38bdf8]" />
        <h2 className="font-syne text-3xl font-extrabold text-white">My <span className="text-[#38bdf8]">Performance</span></h2>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
        <h3 className="mb-4 font-syne text-lg font-bold text-white">Score History — All Tests</h3>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={testTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
              <Line type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={2.5} dot={{ fill: '#38bdf8', r: 3 }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
        <h3 className="mb-4 font-syne text-lg font-bold text-white">My Score vs Class Average</h3>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="subject" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
              <Bar dataKey="myScore" fill="#38bdf8" fillOpacity={0.8} radius={[4, 4, 0, 0]} name="My Score" />
              <Bar dataKey="classAvg" fill="#818cf8" fillOpacity={0.5} radius={[4, 4, 0, 0]} name="Class Avg" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
        <h3 className="mb-4 font-syne text-lg font-bold text-white">Subject Breakdown</h3>
        <div className="space-y-3">
          {subjectData.map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-28 font-instrument text-sm text-white">{s.subject}</span>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-[10px] text-[#64748b]">
                  <span>My Score: {s.myScore}%</span>
                  <span>Class Avg: {s.classAvg}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full ${s.myScore >= s.classAvg ? 'bg-[#34d399]' : 'bg-[#f87171]'}`} style={{ width: `${s.myScore}%` }} />
                </div>
              </div>
              <span className={`w-14 text-right text-xs font-bold ${s.myScore >= s.classAvg ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                {s.myScore >= s.classAvg ? `+${s.myScore - s.classAvg}` : `${s.myScore - s.classAvg}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
