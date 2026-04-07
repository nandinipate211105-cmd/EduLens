import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Send, Bot, User, Sparkles, Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Student, UserProfile } from '../types';
import { subscribeStudents } from '../lib/firebaseService';

interface Props { user?: UserProfile; }
interface Message { role: 'user' | 'ai'; content: string; }

const QUICK_PROMPTS = [
  "What should I study next?",
  "How can I improve my Math score?",
  "Give me a weekly study plan",
  "What are my weakest topics?",
  "How much time per subject daily?",
];

export default function FeedbackTab({ user }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [myData, setMyData] = useState<Student | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeStudents(data => {
      setStudents(data);
      const found = data.find(s =>
        s.name.toLowerCase().includes((user?.displayName || '').split(' ')[0].toLowerCase())
      ) || data[0];
      setMyData(found || null);
      setDataLoading(false);
    });
    return () => unsub();
  }, [user?.displayName]);

  // Init message once we have student data
  useEffect(() => {
    if (!myData || messages.length > 0) return;
    const weakTopics = (myData.topicMastery || []).filter(t => t.label === 'Needs Work').slice(0, 2).map(t => t.topic);
    setMessages([{
      role: 'ai',
      content: `Hi ${myData.name?.split(' ')[0] || 'there'}! 👋 I'm your EduLens AI tutor.\n\n**Your current stats:**\n- Score: **${myData.score}%** | Attendance: **${myData.attendance}%** | Risk: **${myData.riskLevel}**\n\n${weakTopics.length > 0 ? `**Priority Focus:** Work on **${weakTopics.join(' and ')}** — these are your weakest areas right now.\n\n` : ''}Ask me anything about your studies and I'll give you a personalised plan! 🎯`,
    }]);
  }, [myData]);

  const getContext = () => {
    if (!myData) return 'Student data not available.';
    const weakTopics = (myData.topicMastery || []).filter(t => t.label === 'Needs Work').map(t => `${t.subject}:${t.topic}`).join(', ');
    const subScores = (myData.subjectScores || []).map(s => `${s.subject}:${s.score}%`).join(', ');
    return `Student: ${myData.name}, Grade: ${myData.grade}, Score: ${myData.score}%, Attendance: ${myData.attendance}%, Risk: ${myData.riskLevel}. Subjects: ${subScores}. Weak topics: ${weakTopics || 'none detected yet'}.`;
  };

  const handleSend = async (msg?: string) => {
    const text = msg || input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const history = messages.slice(-4).map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');
      const response = await fetch('/.netlify/functions/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          system: `You are EduLens AI Tutor — warm, encouraging, specific. Give ACTIONABLE advice: what to study, how long, in what order. Use markdown. Under 200 words. Student data: ${getContext()}`,
          messages: [{ role: 'user', content: history ? `Context:\n${history}\n\nNew: ${text}` : text }],
        }),
      });
      const data = await response.json();
      const reply = data.content?.find((b: any) => b.type === 'text')?.text || "I'm having trouble connecting right now. Please try again.";
      setMessages(prev => [...prev, { role: 'ai', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: "Connection issue. Please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) return (
    <div className="flex justify-center py-20"><Loader size={28} className="animate-spin text-[#38bdf8]" /></div>
  );

  // Personalised study plan from weak topics
  const studyPlan = myData ? [
    ...((myData.topicMastery || []).filter(t => t.label === 'Needs Work').slice(0, 2).map(t =>
      `📚 Focus on **${t.topic}** (${t.subject}) — 30 mins daily practice`
    )),
    `⏱ Suggested schedule: ${(myData.subjectScores || []).slice(0, 3).map(s => `${s.subject.slice(0,4)} 40min`).join(' → ')}`,
    myData.score >= 70 ? `🎯 You're doing well! Maintain momentum with weekly mock tests` : `🎯 Aim for 70%+ in your next test — focus on ${(myData.topicMastery || []).find(t => t.label === 'Needs Work')?.subject || 'weak subjects'}`,
  ] : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare size={22} className="text-[#818cf8]" />
        <h2 className="font-syne text-3xl font-extrabold text-white">Feedback & <span className="text-[#38bdf8]">AI Assistant</span></h2>
      </div>

      {/* Stats bar */}
      {myData && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'My Score', value: `${myData.score}%`, color: myData.score >= 70 ? 'text-[#34d399]' : 'text-[#f87171]' },
            { label: 'Attendance', value: `${myData.attendance}%`, color: myData.attendance >= 80 ? 'text-[#34d399]' : 'text-[#f87171]' },
            { label: 'Risk Level', value: myData.riskLevel, color: myData.riskLevel === 'HIGH' ? 'text-[#f87171]' : myData.riskLevel === 'MED' ? 'text-[#fbbf24]' : 'text-[#34d399]' },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{k.label}</p>
              <p className={`mt-1 font-syne text-2xl font-extrabold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Study Plan */}
      {studyPlan.length > 0 && (
        <div className="rounded-2xl border border-[#818cf8]/20 bg-[#0f1a2e] p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-[#818cf8]" />
            <h3 className="font-syne text-lg font-bold text-white">AI-Generated Study Plan</h3>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#34d399] border border-[#34d399]/30 rounded-full px-2 py-0.5">Live</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {studyPlan.map((tip, i) => (
              <div key={i} className="flex gap-2 rounded-xl border border-[#818cf8]/10 bg-[#818cf8]/5 p-3">
                <p className="font-instrument text-sm text-[#94a3b8]">{tip.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Chat */}
      <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4 flex items-center gap-2">
          <Bot size={18} className="text-[#38bdf8]" />
          <h3 className="font-syne text-lg font-bold text-white">Chat with AI Tutor</h3>
        </div>

        <div className="flex flex-wrap gap-2 px-6 pt-4">
          {QUICK_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => handleSend(p)} disabled={loading}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 font-instrument text-xs text-[#94a3b8] transition-all hover:border-[#38bdf8]/30 hover:text-white disabled:opacity-50">
              {p}
            </button>
          ))}
        </div>

        <div className="h-[360px] overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${m.role === 'ai' ? 'bg-[#38bdf8]/10 text-[#38bdf8]' : 'bg-[#818cf8]/10 text-[#818cf8]'}`}>
                {m.role === 'ai' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === 'ai' ? 'bg-white/5 text-[#94a3b8]' : 'bg-[#38bdf8] text-[#050a12]'}`}>
                {m.role === 'ai'
                  ? <div className="font-instrument text-sm prose prose-invert prose-sm max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                  : <p className="font-instrument text-sm font-bold">{m.content}</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#38bdf8]/10 text-[#38bdf8]"><Bot size={16} /></div>
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(j => <div key={j} className="h-2 w-2 rounded-full bg-[#38bdf8] animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-4 flex gap-3">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask your AI tutor anything…"
            className="flex-1 rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2.5 font-instrument text-sm text-white outline-none focus:border-[#38bdf8] transition-colors" />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#38bdf8] text-[#050a12] transition-all hover:bg-[#7dd3fc] disabled:opacity-40">
            <Send size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
