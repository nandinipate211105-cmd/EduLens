import { motion } from 'motion/react';
import { SEED_STUDENTS } from '../lib/seedData';
import { Bell, Mail, MessageSquare, Filter } from 'lucide-react';
import { useState } from 'react';

const ALERTS = [
  ...SEED_STUDENTS.filter(s => s.riskLevel === 'HIGH').map(s => ({
    id: s.name + '-risk',
    type: 'risk' as const,
    student: s.name,
    grade: s.grade,
    message: `High risk: Score ${s.score}%, Attendance ${s.attendance}% — immediate intervention needed`,
    severity: 'high' as const,
    time: '2 hours ago',
  })),
  ...SEED_STUDENTS.filter(s => s.attendance < 75).map(s => ({
    id: s.name + '-att',
    type: 'attendance' as const,
    student: s.name,
    grade: s.grade,
    message: `Attendance dropped to ${s.attendance}% — parent notification recommended`,
    severity: 'high' as const,
    time: '4 hours ago',
  })),
  ...SEED_STUDENTS.filter(s => s.riskLevel === 'MED').map(s => ({
    id: s.name + '-perf',
    type: 'performance' as const,
    student: s.name,
    grade: s.grade,
    message: `Performance declining: ${s.score}% average with downward trend`,
    severity: 'medium' as const,
    time: '1 day ago',
  })),
];

const TYPE_COLOR = { risk: 'text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20', attendance: 'text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20', performance: 'text-[#818cf8] bg-[#818cf8]/10 border-[#818cf8]/20' };
const SEV_COLOR = { high: 'bg-[#f87171]/10 text-[#f87171]', medium: 'bg-[#fbbf24]/10 text-[#fbbf24]', low: 'bg-[#34d399]/10 text-[#34d399]' };

export default function AlertsTab() {
  const [filter, setFilter] = useState<'all' | 'risk' | 'attendance' | 'performance'>('all');
  const [sent, setSent] = useState<Set<string>>(new Set());

  const filtered = ALERTS.filter(a => filter === 'all' || a.type === filter);

  const sendAlert = (id: string) => setSent(prev => new Set([...prev, id]));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell size={22} className="text-[#fbbf24]" />
        <h2 className="font-syne text-3xl font-extrabold text-white">Alerts & <span className="text-[#38bdf8]">Notifications</span></h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'High Priority', value: ALERTS.filter(a => a.severity === 'high').length, color: 'text-[#f87171]' },
          { label: 'Medium Priority', value: ALERTS.filter(a => a.severity === 'medium').length, color: 'text-[#fbbf24]' },
          { label: 'Total Alerts', value: ALERTS.length, color: 'text-white' },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{k.label}</p>
            <p className={`mt-2 font-syne text-3xl font-extrabold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Filter size={16} className="text-[#64748b] mt-1.5" />
        {(['all', 'risk', 'attendance', 'performance'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-xl px-3 py-1.5 font-syne text-xs font-bold transition-all capitalize ${filter === f ? 'bg-[#38bdf8] text-[#050a12]' : 'border border-white/10 text-[#64748b] hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((alert) => (
          <div key={alert.id} className={`rounded-2xl border p-4 ${TYPE_COLOR[alert.type]}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-syne text-sm font-bold text-white">{alert.student}</span>
                  <span className="text-[10px] text-[#64748b]">{alert.grade}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${SEV_COLOR[alert.severity]}`}>{alert.severity}</span>
                </div>
                <p className="font-instrument text-sm text-[#94a3b8]">{alert.message}</p>
                <p className="mt-1 text-[10px] text-[#64748b]">{alert.time}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => sendAlert(alert.id)}
                  className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${sent.has(alert.id) ? 'bg-[#34d399]/20 text-[#34d399]' : 'bg-white/10 text-white hover:bg-[#38bdf8]/20 hover:text-[#38bdf8]'}`}>
                  <Mail size={14} />
                  {sent.has(alert.id) ? 'Sent' : 'Notify Parent'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Actions */}
      <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
        <h3 className="mb-3 font-syne text-lg font-bold text-white">Bulk Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => ALERTS.forEach(a => setSent(prev => new Set([...prev, a.id])))}
            className="flex items-center gap-2 rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/20 px-4 py-2 text-sm font-bold text-[#38bdf8] transition-all hover:bg-[#38bdf8]/20">
            <Mail size={16} /> Send All Parent Notifications
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-[#818cf8]/10 border border-[#818cf8]/20 px-4 py-2 text-sm font-bold text-[#818cf8] transition-all hover:bg-[#818cf8]/20">
            <MessageSquare size={16} /> Send Bulk SMS (Demo)
          </button>
        </div>
      </div>
    </motion.div>
  );
}
