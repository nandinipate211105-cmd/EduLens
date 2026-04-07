import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UserProfile, Student, AttendanceRecord } from '../types';
import { Calendar, AlertTriangle, CheckCircle, XCircle, Save } from 'lucide-react';
import { subscribeStudents, subscribeAttendance, subscribeAttendanceRange, markAttendance, subscribeStudentAttendance } from '../lib/firebaseService';

interface Props { user: UserProfile; isTeacher?: boolean; }

export default function AttendanceTab({ user, isTeacher = true }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>([]);

  // Last 7 dates for summary bar chart
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    const unsub = subscribeStudents(setStudents);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAttendance(selectedDate, setRecords);
    return () => unsub();
  }, [selectedDate]);

  // Teacher: load last-7-days attendance for real weekly chart + absentees
  useEffect(() => {
    if (!isTeacher) return;
    const unsub = subscribeAttendanceRange(last7, setWeekRecords);
    return () => unsub();
  }, [isTeacher, last7.join(',')]);

  // For student: load their own records
  useEffect(() => {
    if (isTeacher) return;
    // Match student by displayName (first name match or uid match)
    const myStudent = students.find(s =>
      s.name.toLowerCase().includes((user.displayName || '').split(' ')[0].toLowerCase())
    );
    if (myStudent?.id) {
      const unsub = subscribeStudentAttendance(myStudent.id, setMyRecords);
      return () => unsub();
    }
  }, [isTeacher, students, user.displayName]);

  const getStatus = (studentId: string) => {
    const r = records.find(r => r.studentId === studentId);
    return r ? r.present : null;
  };

  const handleToggle = async (student: Student) => {
    if (!isTeacher || !student.id) return;
    const current = getStatus(student.id);
    const newVal = current === null ? true : !current;
    setSaving(student.id);
    await markAttendance({
      date: selectedDate,
      studentId: student.id,
      studentName: student.name,
      present: newVal,
    });
    setSaving(null);
  };

  const presentCount = records.filter(r => r.present).length;
  const absentCount = records.filter(r => !r.present).length;
  const markedCount = records.length;

  // My attendance stats (student view)
  const myPresent = myRecords.filter(r => r.present).length;
  const myTotal = myRecords.length;
  const myPct = myTotal > 0 ? Math.round((myPresent / myTotal) * 100) : 0;

  // Chart data
  const chartData = last7.map(date => {
    const dayRecs = (isTeacher ? weekRecords : myRecords).filter(r => r.date === date);
    const present = dayRecs.filter(r => r.present).length;
    const absent = dayRecs.filter(r => !r.present).length;
    const baseTotal = isTeacher ? students.length : Math.max(myRecords.length, present + absent);
    const unmarked = Math.max(0, baseTotal - (present + absent));
    return { date: date.slice(5), present, absent, unmarked };
  });

  const lowAtt = students.filter(s => s.attendance < 75);

  // Frequent absentees (last 7 days) — based on actual attendance records
  const absentCounts = students.map(s => {
    const sid = s.id || '';
    const abs = weekRecords.filter(r => r.studentId === sid && r.present === false).length;
    const total = weekRecords.filter(r => r.studentId === sid).length;
    return { student: s, absences: abs, marked: total };
  }).sort((a, b) => b.absences - a.absences);
  const frequentAbsentees = absentCounts.filter(x => x.absences >= 2).slice(0, 6);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar size={22} className="text-[#38bdf8]" />
        <h2 className="font-syne text-3xl font-extrabold text-white">Attendance <span className="text-[#38bdf8]">Tracker</span></h2>
      </div>

      {/* Weekly Pattern Chart (real) */}
      <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
        <h3 className="mb-4 font-syne text-lg font-bold text-white">Last 7 Days — Attendance Pattern</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
              <Bar dataKey="present" stackId="a" fill="#34d399" fillOpacity={0.75} radius={[4, 4, 0, 0]} name="Present" />
              <Bar dataKey="absent" stackId="a" fill="#f87171" fillOpacity={0.75} radius={[4, 4, 0, 0]} name="Absent" />
              <Bar dataKey="unmarked" stackId="a" fill="#64748b" fillOpacity={0.35} radius={[4, 4, 0, 0]} name="Unmarked" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-[#64748b]">
          Chart is built from real attendance records. Unmarked = students not marked for that day.
        </p>
      </div>

      {/* Student View */}
      {!isTeacher && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'My Attendance', value: `${myPct}%`, color: myPct >= 80 ? 'text-[#34d399]' : 'text-[#f87171]' },
              { label: 'Present Days', value: myPresent, color: 'text-white' },
              { label: 'Absent Days', value: myTotal - myPresent, color: 'text-[#f87171]' },
            ].map((k, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{k.label}</p>
                <p className={`mt-2 font-syne text-3xl font-extrabold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
            <h3 className="mb-4 font-syne text-lg font-bold text-white">My Recent Attendance</h3>
            {myRecords.length === 0 ? (
              <p className="font-instrument text-sm text-[#64748b]">No attendance records yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {myRecords.slice(0, 10).map((r, i) => (
                  <div key={i} className={`rounded-xl border p-3 text-center ${r.present ? 'border-[#34d399]/20 bg-[#34d399]/10' : 'border-[#f87171]/20 bg-[#f87171]/10'}`}>
                    <p className="font-syne text-xs font-bold text-white">{r.date.slice(5)}</p>
                    <p className={`mt-1 font-instrument text-xs ${r.present ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{r.present ? 'Present' : 'Absent'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Teacher View */}
      {isTeacher && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Present Today', value: presentCount, color: 'text-[#34d399]' },
              { label: 'Absent Today', value: absentCount, color: 'text-[#f87171]' },
              { label: 'Marked / Total', value: `${markedCount}/${students.length}`, color: 'text-white' },
            ].map((k, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{k.label}</p>
                <p className={`mt-2 font-syne text-3xl font-extrabold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="font-syne text-lg font-bold text-white">Mark Attendance</h3>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-white outline-none focus:border-[#38bdf8]" />
            </div>

            {students.length === 0 ? (
              <p className="font-instrument text-sm text-[#64748b]">No students yet. Seed demo data from the Dashboard.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {students.map(s => {
                  const status = s.id ? getStatus(s.id) : null;
                  return (
                    <button key={s.id} onClick={() => handleToggle(s)} disabled={saving === s.id}
                      className={`flex items-center justify-between rounded-xl border p-3 transition-all hover:scale-[1.01] ${
                        status === true ? 'border-[#34d399]/30 bg-[#34d399]/10' :
                        status === false ? 'border-[#f87171]/30 bg-[#f87171]/10' :
                        'border-white/10 bg-white/5'
                      }`}>
                      <div className="text-left">
                        <p className="font-syne text-sm font-bold text-white">{s.name}</p>
                        <p className="text-xs text-[#64748b]">{s.grade}</p>
                      </div>
                      {saving === s.id ? (
                        <div className="h-5 w-5 rounded-full border-2 border-[#38bdf8] border-t-transparent animate-spin" />
                      ) : status === true ? (
                        <CheckCircle size={18} className="text-[#34d399]" />
                      ) : status === false ? (
                        <XCircle size={18} className="text-[#f87171]" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-white/20" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {lowAtt.length > 0 && (
            <div className="rounded-2xl border border-[#f87171]/20 bg-[#0f1a2e] p-6">
              <h3 className="mb-4 font-syne text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-[#f87171]" /> Low Attendance Alerts
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {lowAtt.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-[#f87171]/20 bg-[#f87171]/5 p-4">
                    <div>
                      <p className="font-syne text-sm font-bold text-white">{s.name}</p>
                      <p className="text-xs text-[#f87171]">{s.attendance}% — below 75% threshold</p>
                    </div>
                    <span className="rounded-full bg-[#f87171]/10 px-2 py-0.5 text-[10px] font-bold text-[#f87171]">Alert</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {frequentAbsentees.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
              <h3 className="mb-4 font-syne text-lg font-bold text-white">Frequent Absentees (last 7 days)</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {frequentAbsentees.map((x, i) => (
                  <div key={x.student.id || i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                    <div>
                      <p className="font-syne text-sm font-bold text-white">{x.student.name}</p>
                      <p className="text-xs text-[#64748b]">{x.student.grade} · Marked: {x.marked} days</p>
                    </div>
                    <span className="rounded-full bg-[#f87171]/10 px-2 py-0.5 text-[10px] font-bold text-[#f87171]">
                      {x.absences} absences
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
