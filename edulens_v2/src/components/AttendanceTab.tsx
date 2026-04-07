import { motion } from 'motion/react';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { SEED_STUDENTS, WEEKLY_ATTENDANCE } from '../lib/seedData';
import { UserProfile } from '../types';
import { Calendar, AlertTriangle } from 'lucide-react';

interface Props { user: UserProfile; isTeacher?: boolean; }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DATES = ['Apr 1', 'Apr 2', 'Apr 3', 'Apr 7', 'Apr 8'];

function genAttendance(name: string) {
  const seed = name.charCodeAt(0);
  return DAYS.map((d, i) => ({
    day: d,
    date: DATES[i],
    present: (seed + i) % 7 !== 0 && (seed + i) % 5 !== 2,
  }));
}

export default function AttendanceTab({ user, isTeacher = true }: Props) {
  const [selectedDate, setSelectedDate] = useState('Apr 7');
  const [attendance, setAttendance] = useState<Record<string, Record<string, boolean>>>(() => {
    const init: Record<string, Record<string, boolean>> = {};
    SEED_STUDENTS.forEach(s => {
      init[s.name] = {};
      genAttendance(s.name).forEach(a => { init[s.name][a.date] = a.present; });
    });
    return init;
  });

  const toggle = (name: string, date: string) => {
    if (!isTeacher) return;
    setAttendance(prev => ({ ...prev, [name]: { ...prev[name], [date]: !prev[name][date] } }));
  };

  const lowAtt = SEED_STUDENTS.filter(s => s.attendance < 75);

  const trendData = DATES.map(date => ({
    date,
    present: SEED_STUDENTS.filter(s => attendance[s.name]?.[date]).length,
    absent: SEED_STUDENTS.filter(s => !attendance[s.name]?.[date]).length,
  }));

  // Student view — show own attendance
  const myAtt = genAttendance(user.displayName || 'Student');
  const myPct = Math.round((myAtt.filter(a => a.present).length / myAtt.length) * 100);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar size={22} className="text-[#38bdf8]" />
        <h2 className="font-syne text-3xl font-extrabold text-white">Attendance <span className="text-[#38bdf8]">Tracker</span></h2>
      </div>

      {!isTeacher && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">My Attendance</p>
            <p className={`mt-2 font-syne text-3xl font-extrabold ${myPct >= 80 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{myPct}%</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Present Days</p>
            <p className="mt-2 font-syne text-3xl font-extrabold text-white">{myAtt.filter(a => a.present).length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Absent Days</p>
            <p className="mt-2 font-syne text-3xl font-extrabold text-[#f87171]">{myAtt.filter(a => !a.present).length}</p>
          </div>
        </div>
      )}

      {!isTeacher && (
        <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
          <h3 className="mb-4 font-syne text-lg font-bold text-white">My Attendance This Week</h3>
          <div className="flex gap-3">
            {myAtt.map((a, i) => (
              <div key={i} className={`flex-1 rounded-xl border p-3 text-center ${a.present ? 'border-[#34d399]/20 bg-[#34d399]/10' : 'border-[#f87171]/20 bg-[#f87171]/10'}`}>
                <p className="font-syne text-xs font-bold text-white">{a.day}</p>
                <p className="text-[10px] text-[#64748b]">{a.date}</p>
                <p className={`mt-1 text-lg ${a.present ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{a.present ? '✓' : '✗'}</p>
              </div>
            ))}
          </div>
          {myPct < 80 && (
            <div className="mt-4 flex gap-2 rounded-xl border border-[#f87171]/20 bg-[#f87171]/5 p-3">
              <AlertTriangle size={16} className="text-[#f87171] flex-shrink-0 mt-0.5" />
              <p className="font-instrument text-sm text-[#f87171]">Your attendance is below 80%. Regular attendance is critical for academic performance.</p>
            </div>
          )}
        </div>
      )}

      {isTeacher && (
        <>
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-syne text-lg font-bold text-white">Mark Attendance</h3>
              <div className="flex gap-2">
                {DATES.map(d => (
                  <button key={d} onClick={() => setSelectedDate(d)}
                    className={`rounded-lg px-3 py-1.5 font-syne text-xs font-bold transition-all ${selectedDate === d ? 'bg-[#38bdf8] text-[#050a12]' : 'border border-white/10 text-[#64748b] hover:text-white'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SEED_STUDENTS.map((s, i) => {
                const present = attendance[s.name]?.[selectedDate] ?? true;
                return (
                  <button key={i} onClick={() => toggle(s.name, selectedDate)}
                    className={`flex items-center justify-between rounded-xl border p-3 transition-all ${present ? 'border-[#34d399]/20 bg-[#34d399]/5 hover:bg-[#34d399]/10' : 'border-[#f87171]/20 bg-[#f87171]/5 hover:bg-[#f87171]/10'}`}>
                    <div className="text-left">
                      <p className="font-syne text-sm font-bold text-white">{s.name}</p>
                      <p className="text-[10px] text-[#64748b]">{s.grade}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${present ? 'bg-[#34d399]/20 text-[#34d399]' : 'bg-[#f87171]/20 text-[#f87171]'}`}>
                      {present ? 'Present' : 'Absent'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
              <h3 className="mb-4 font-syne text-lg font-bold text-white">Weekly Trend</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                    <Line type="monotone" dataKey="present" stroke="#34d399" strokeWidth={2} dot={false} name="Present" />
                    <Line type="monotone" dataKey="absent" stroke="#f87171" strokeWidth={2} dot={false} name="Absent" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-[#f87171]" />
                <h3 className="font-syne text-lg font-bold text-white">Low Attendance Alerts</h3>
              </div>
              <div className="space-y-2">
                {lowAtt.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-[#f87171]/10 bg-[#f87171]/5 p-3">
                    <div>
                      <p className="font-syne text-sm font-bold text-white">{s.name}</p>
                      <p className="text-xs text-[#64748b]">{s.grade} · {s.attendance}% attendance</p>
                    </div>
                    <span className="text-xs font-bold text-[#f87171]">⚠ Critical</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
