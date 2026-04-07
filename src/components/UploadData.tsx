import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Upload, FileText, CheckCircle, Loader2, Brain, AlertTriangle,
  ChevronDown, ChevronUp, Eye, BarChart2, BookOpen
} from 'lucide-react';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { QuestionPaper, UserProfile, Student } from '../types';
import { subscribeStudents, updateStudent } from '../lib/firebaseService';

interface UploadDataProps { user: UserProfile; }
interface WeakTopic { topic: string; reason: string; severity: 'high' | 'medium' | 'low'; }
interface AnswerSheetResult {
  id: string; studentName: string; subject: string; percentage: number;
  weakTopics: WeakTopic[]; feedback: string; studyPlan?: string; fileUrl: string; checkedAt: string;
}

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl font-instrument ${type === 'success' ? 'bg-[#0f1a2e] border-[#34d399]/30 text-white' : 'bg-[#0f1a2e] border-[#f87171]/30 text-white'}`;
  toast.innerText = `${type === 'success' ? '✅' : '⚠️'} ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

const AI_ENDPOINT = '/.netlify/functions/gemini';

async function extractQuestionsWithGemini(base64: string, mimeType: string, subject: string): Promise<string[]> {
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'extractQuestions', base64, mimeType, subject }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `AI request failed (${response.status})`);
  }
  const data = await response.json();
  return Array.isArray(data.questions) ? data.questions : [];
}

async function analyseAnswerSheet(base64: string, mimeType: string, studentName: string, subject: string, questions: string[]) {
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'analyzeAnswerSheet', base64, mimeType, studentName, subject, questions }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `AI analysis failed (${response.status})`);
  }
  return response.json();
}

export default function UploadData({ user }: UploadDataProps) {
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<AnswerSheetResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'paper' | 'answer' | 'results'>('paper');
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [paperTitle, setPaperTitle] = useState('');
  const [paperSubject, setPaperSubject] = useState('Math');
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const paperFileRef = useRef<HTMLInputElement>(null);
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const answerFileRef = useRef<HTMLInputElement>(null);
  const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Computer Science', 'Physics'];
  const SEV_COLOR = { high: 'text-[#f87171] bg-[#f87171]/10', medium: 'text-[#fbbf24] bg-[#fbbf24]/10', low: 'text-[#34d399] bg-[#34d399]/10' } as const;

  useEffect(() => {
    const q1 = query(collection(db, 'questionPapers'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q1, s => setPapers(s.docs.map(d => ({ id: d.id, ...d.data() }) as QuestionPaper)), e => console.warn(e.message));
    const q2 = query(collection(db, 'answerSheets'), orderBy('checkedAt', 'desc'));
    const u2 = onSnapshot(q2, s => setResults(s.docs.map(d => ({ id: d.id, ...d.data() }) as AnswerSheetResult)), e => console.warn(e.message));
    const u3 = subscribeStudents(setStudents);
    return () => { u1(); u2(); u3(); };
  }, []);

  const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader(); r.readAsDataURL(file);
    r.onload = () => res((r.result as string).split(',')[1]); r.onerror = () => rej(new Error('Failed to read file'));
  });

  const uploadToStorage = async (file: File, folder: string): Promise<string> => {
    const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleUploadPaper = async () => {
    if (!paperFile || !paperTitle.trim() || loading) return;
    setLoading(true); setProgress('Uploading file to Firebase Storage…');
    try {
      const fileUrl = await uploadToStorage(paperFile, 'papers');
      setProgress('Gemini AI is extracting questions…');
      const base64 = await fileToBase64(paperFile);
      const questions = await extractQuestionsWithGemini(base64, paperFile.type, paperSubject);
      setProgress('Saving to Firestore…');
      await addDoc(collection(db, 'questionPapers'), { title: paperTitle.trim(), subject: paperSubject, fileUrl, questions, isSet: false, uploadedBy: user.uid, createdAt: serverTimestamp() });
      setPaperTitle(''); setPaperSubject('Math'); setPaperFile(null);
      if (paperFileRef.current) paperFileRef.current.value = '';
      showToast(`Paper uploaded! ${questions.length} questions extracted ✅`);
      setActiveTab('answer');
    } catch (err: any) { showToast(err.message || 'Upload failed', 'error'); }
    finally { setLoading(false); setProgress(''); }
  };

  const handleUploadAnswer = async () => {
    if (!answerFile || !selectedPaperId || !selectedStudentId || loading) return;
    const paper = papers.find(p => p.id === selectedPaperId);
    const student = students.find(s => s.id === selectedStudentId);
    if (!paper || !student) { showToast('Paper or student not found.', 'error'); return; }
    setLoading(true); setProgress('Uploading answer sheet…');
    try {
      const fileUrl = await uploadToStorage(answerFile, 'answers');
      setProgress('🤖 Gemini AI is reading & analysing…');
      const base64 = await fileToBase64(answerFile);
      const analysis = await analyseAnswerSheet(base64, answerFile.type, student.name, paper.subject, paper.questions);
      setProgress('Saving results…');
      await addDoc(collection(db, 'answerSheets'), { studentId: student.id, studentName: student.name, paperId: paper.id, subject: paper.subject, fileUrl, aiFeedback: analysis.feedback, studyPlan: analysis.studyPlan, score: analysis.score, maxScore: analysis.maxScore, percentage: analysis.percentage, weakTopics: analysis.weakTopics, strongTopics: analysis.strongTopics, checkedAt: serverTimestamp(), createdAt: serverTimestamp() });
      if (student.id) {
        const updatedMastery = [...(student.topicMastery || [])];
        (analysis.weakTopics || []).forEach((wt: WeakTopic) => {
          const idx = updatedMastery.findIndex(t => t.topic.toLowerCase().includes(wt.topic.toLowerCase()) && t.subject === paper.subject);
          const nm = wt.severity === 'high' ? 28 : wt.severity === 'medium' ? 48 : 63;
          if (idx >= 0) { updatedMastery[idx] = { ...updatedMastery[idx], mastery: nm, label: nm >= 80 ? 'Mastered' : nm >= 55 ? 'Developing' : 'Needs Work', errorPattern: wt.reason }; }
          else { updatedMastery.push({ subject: paper.subject, topic: wt.topic, mastery: nm, label: 'Needs Work', errorPattern: wt.reason }); }
        });
        // Also append test history so the Learning Gaps curve graph becomes real over time
        const prevHistory = student.testHistory || [];
        const nextHistory = [
          ...prevHistory,
          {
            testId: `${paper.title || paper.subject}-T${prevHistory.length + 1}`,
            subject: paper.subject,
            date: new Date().toISOString().split('T')[0],
            score: Number(analysis.score || analysis.percentage || 0),
            maxScore: Number(analysis.maxScore || 100),
            topics: (analysis.weakTopics || []).map((w: any) => w.topic).slice(0, 6),
          }
        ];
        await updateStudent(student.id, {
          topicMastery: updatedMastery,
          testHistory: nextHistory,
          score: Math.round((student.score || 0) * 0.7 + Number(analysis.percentage || 0) * 0.3),
        });
      }
      setAnswerFile(null); setSelectedPaperId(''); setSelectedStudentId('');
      if (answerFileRef.current) answerFileRef.current.value = '';
      showToast(`Graded! Score: ${analysis.percentage}% — profile updated ✅`);
      setActiveTab('results');
    } catch (err: any) { showToast(err.message || 'Analysis failed', 'error'); }
    finally { setLoading(false); setProgress(''); }
  };

  const handleSetPaper = async (id: string) => {
    for (const p of papers) { if (p.id && p.isSet) await updateDoc(doc(db, 'questionPapers', p.id), { isSet: false }); }
    await updateDoc(doc(db, 'questionPapers', id), { isSet: true });
    showToast('Paper set as active 🎯');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div>
        <h2 className="font-syne text-3xl font-extrabold text-white">Upload <span className="text-[#38bdf8]">&amp; Analyse</span></h2>
        <p className="mt-1 font-instrument text-[#64748b]">Upload PDFs/images → Gemini AI reads them → weak topics auto-detected → student profile updated.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{step:'1',label:'Upload Question Paper',color:'border-[#38bdf8]/30 text-[#38bdf8]'},{step:'2',label:'Upload Answer Sheet',color:'border-[#818cf8]/30 text-[#818cf8]'},{step:'3',label:'Gemini AI Detects Weak Topics',color:'border-[#fbbf24]/30 text-[#fbbf24]'},{step:'4',label:'Firebase Auto-Updated',color:'border-[#34d399]/30 text-[#34d399]'}].map((s,i) => (
          <div key={i} className={`rounded-xl border bg-[#0f1a2e] p-3 text-center ${s.color}`}>
            <p className={`font-syne text-xl font-extrabold ${s.color.split(' ')[1]}`}>{s.step}</p>
            <p className="font-instrument text-xs text-[#64748b] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {[{key:'paper',label:'📄 Question Papers'},{key:'answer',label:'✍️ Answer Sheets'},{key:'results',label:`📊 Results (${results.length})`}].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`rounded-xl px-5 py-2 font-syne text-sm font-bold transition-all ${activeTab===t.key?'bg-[#38bdf8] text-[#050a12]':'border border-white/10 bg-[#0f1a2e] text-[#64748b] hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {loading && (
        <div className="rounded-2xl border border-[#38bdf8]/20 bg-[#0f1a2e] p-4">
          <div className="flex items-center gap-3 mb-3"><Loader2 size={18} className="animate-spin text-[#38bdf8]" /><p className="font-instrument text-sm text-[#38bdf8]">{progress}</p></div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#38bdf8] to-[#818cf8] animate-pulse" style={{width:'70%'}} /></div>
        </div>
      )}

      {activeTab === 'paper' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6 space-y-4">
            <h3 className="font-syne text-lg font-bold text-white flex items-center gap-2"><FileText size={18} className="text-[#38bdf8]" /> Upload Question Paper</h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Exam Title</label>
              <input type="text" value={paperTitle} onChange={e => setPaperTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-[#38bdf8]" placeholder="e.g. Mid-Term Exam 2025" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Subject</label>
              <select value={paperSubject} onChange={e => setPaperSubject(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-[#38bdf8]">
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">PDF / Image</label>
              <input ref={paperFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setPaperFile(e.target.files?.[0]||null)} className="hidden" id="paper-file" />
              <label htmlFor="paper-file" className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-8 transition-all ${paperFile?'border-[#38bdf8]/50 bg-[#38bdf8]/5':'border-white/20 bg-white/5 hover:border-[#38bdf8] hover:bg-white/10'}`}>
                <Upload size={18} className={paperFile?'text-[#38bdf8]':'text-[#64748b]'} />
                <span className={`text-sm ${paperFile?'text-[#38bdf8] font-bold':'text-[#64748b]'}`}>{paperFile?paperFile.name:'Click to upload PDF or image'}</span>
              </label>
            </div>
            <button onClick={handleUploadPaper} disabled={loading||!paperFile||!paperTitle.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#38bdf8] py-3 font-syne text-sm font-bold text-[#050a12] transition-all hover:bg-[#7dd3fc] disabled:opacity-50">
              {loading?<Loader2 className="animate-spin" size={18}/>:<Upload size={18}/>} Upload &amp; Extract Questions
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6">
            <h3 className="mb-4 font-syne text-lg font-bold text-white">Uploaded Papers ({papers.length})</h3>
            {papers.length===0?(
              <div className="flex flex-col items-center justify-center py-12 text-center"><FileText size={32} className="mb-3 text-[#64748b]" /><p className="font-syne text-sm font-bold text-[#64748b]">No papers yet</p></div>
            ):(
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {papers.map(p => (
                  <div key={p.id} className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="min-w-0"><p className="font-syne text-sm font-bold text-white truncate">{p.title}</p><p className="text-xs text-[#64748b]">{p.subject} · {p.questions.length} questions</p></div>
                      <button onClick={() => handleSetPaper(p.id!)} disabled={p.isSet} className={`flex-shrink-0 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${p.isSet?'bg-[#34d399]/10 text-[#34d399]':'bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20'}`}>{p.isSet?'✓ Active':'Set Active'}</button>
                    </div>
                    <div className="max-h-20 overflow-y-auto rounded-lg bg-black/20 p-2">
                      {p.questions.slice(0,5).map((q,i) => <p key={i} className="text-[10px] text-[#64748b] mb-0.5 truncate">{q}</p>)}
                      {p.questions.length>5 && <p className="text-[10px] text-[#38bdf8]">+{p.questions.length-5} more…</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'answer' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6 space-y-4">
            <h3 className="font-syne text-lg font-bold text-white flex items-center gap-2"><Brain size={18} className="text-[#818cf8]" /> Upload Answer Sheet</h3>
            {papers.length===0 && <div className="rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/5 p-3 text-sm font-instrument text-[#fbbf24]">⚠ No question papers yet — upload a paper first.</div>}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Select Question Paper</label>
              <select value={selectedPaperId} onChange={e => setSelectedPaperId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-[#38bdf8]">
                <option value="">Choose a paper…</option>
                {papers.map(p => <option key={p.id} value={p.id}>{p.title} ({p.subject})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Select Student</label>
              <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-[#38bdf8]">
                <option value="">Choose a student…</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Answer Sheet (PDF / Image)</label>
              <input ref={answerFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setAnswerFile(e.target.files?.[0]||null)} className="hidden" id="answer-file" />
              <label htmlFor="answer-file" className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-8 transition-all ${answerFile?'border-[#818cf8]/50 bg-[#818cf8]/5':'border-white/20 bg-white/5 hover:border-[#818cf8] hover:bg-white/10'}`}>
                <Upload size={18} className={answerFile?'text-[#818cf8]':'text-[#64748b]'} />
                <span className={`text-sm ${answerFile?'text-[#818cf8] font-bold':'text-[#64748b]'}`}>{answerFile?answerFile.name:'Click to upload PDF or image'}</span>
              </label>
            </div>
            <div className="rounded-xl border border-[#818cf8]/20 bg-[#818cf8]/5 p-3 flex items-start gap-2">
              <Brain size={16} className="text-[#818cf8] mt-0.5 flex-shrink-0" />
              <p className="font-instrument text-xs text-[#94a3b8]">Claude AI reads the answer sheet, detects weak topics, generates score &amp; feedback, and auto-updates the student's profile.</p>
            </div>
            <button onClick={handleUploadAnswer} disabled={loading||!answerFile||!selectedPaperId||!selectedStudentId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#818cf8] to-[#38bdf8] py-3 font-syne text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50">
              {loading?<Loader2 className="animate-spin" size={18}/>:<Brain size={18}/>} Analyse with Gemini AI
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-6 flex flex-col gap-4">
            <h3 className="font-syne text-lg font-bold text-white">What Gemini AI detects</h3>
            {[{icon:AlertTriangle,color:'text-[#f87171]',title:'Weak Topics',desc:'Identifies exactly which topics the student got wrong with specific reasons'},{icon:BarChart2,color:'text-[#38bdf8]',title:'Score & Percentage',desc:'Auto-grades the paper and calculates accurate percentage'},{icon:BookOpen,color:'text-[#818cf8]',title:'Personalised Study Plan',desc:'Generates a 3-step plan to fix weak areas'},{icon:CheckCircle,color:'text-[#34d399]',title:'Firebase Auto-Update',desc:"Student's Learning Gaps updated in real-time"}].map((item,i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-3">
                <item.icon size={16} className={`${item.color} mt-0.5 flex-shrink-0`} />
                <div><p className="font-syne text-sm font-bold text-white">{item.title}</p><p className="font-instrument text-xs text-[#64748b]">{item.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-4">
          {results.length===0?(
            <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-12 text-center"><BarChart2 size={40} className="mx-auto mb-4 text-[#64748b]" /><p className="font-syne text-white font-bold">No results yet</p><p className="font-instrument text-sm text-[#64748b] mt-1">Upload and grade an answer sheet to see AI analysis here.</p></div>
          ):(
            results.map(r => {
              const isOpen = expandedResult===r.id;
              const pct = r.percentage||0;
              return (
                <motion.div key={r.id} layout className="rounded-2xl border border-white/10 bg-[#0f1a2e] overflow-hidden">
                  <button onClick={() => setExpandedResult(isOpen?null:r.id)} className="flex w-full items-center justify-between p-5 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-left"><p className="font-syne text-sm font-bold text-white">{r.studentName}</p><p className="text-xs text-[#64748b]">{r.subject}</p></div>
                      <div className={`rounded-full px-3 py-1 text-xs font-bold ${pct>=70?'bg-[#34d399]/10 text-[#34d399]':pct>=50?'bg-[#fbbf24]/10 text-[#fbbf24]':'bg-[#f87171]/10 text-[#f87171]'}`}>{pct}%</div>
                      <div className="flex gap-1 flex-wrap">{(r.weakTopics||[]).slice(0,3).map((wt,i) => (<span key={i} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SEV_COLOR[wt.severity]}`}>⚠ {wt.topic}</span>))}</div>
                    </div>
                    {isOpen?<ChevronUp size={16} className="text-[#64748b] flex-shrink-0"/>:<ChevronDown size={16} className="text-[#64748b] flex-shrink-0"/>}
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/10 p-5 space-y-4">
                      <div>
                        <div className="flex justify-between mb-1"><span className="font-syne text-xs font-bold text-white">Score</span><span className={`font-syne text-xs font-bold ${pct>=70?'text-[#34d399]':pct>=50?'text-[#fbbf24]':'text-[#f87171]'}`}>{pct}%</span></div>
                        <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden"><div className={`h-full rounded-full ${pct>=70?'bg-[#34d399]':pct>=50?'bg-[#fbbf24]':'bg-[#f87171]'}`} style={{width:`${pct}%`}} /></div>
                      </div>
                      {(r.weakTopics||[]).length>0 && (
                        <div><p className="font-syne text-xs font-bold text-white mb-2">⚠ Weak Topics Detected</p>
                          <div className="grid gap-2 sm:grid-cols-2">{(r.weakTopics||[]).map((wt,i) => (
                            <div key={i} className={`rounded-xl p-3 border ${wt.severity==='high'?'border-[#f87171]/20 bg-[#f87171]/5':wt.severity==='medium'?'border-[#fbbf24]/20 bg-[#fbbf24]/5':'border-[#34d399]/20 bg-[#34d399]/5'}`}>
                              <div className="flex items-center justify-between mb-1"><span className="font-syne text-sm font-bold text-white">{wt.topic}</span><span className={`text-[10px] font-bold uppercase ${SEV_COLOR[wt.severity]}`}>{wt.severity}</span></div>
                              <p className="font-instrument text-xs text-[#64748b]">{wt.reason}</p>
                            </div>
                          ))}</div>
                        </div>
                      )}
                      {r.feedback && <div className="rounded-xl border border-[#818cf8]/20 bg-[#818cf8]/5 p-4"><p className="font-syne text-xs font-bold text-[#818cf8] mb-1">AI Feedback</p><p className="font-instrument text-sm text-[#94a3b8]">{r.feedback}</p></div>}
                      {r.studyPlan && <div className="rounded-xl border border-[#34d399]/20 bg-[#34d399]/5 p-4"><p className="font-syne text-xs font-bold text-[#34d399] mb-1">📚 Study Plan</p><p className="font-instrument text-sm text-[#94a3b8]">{r.studyPlan}</p></div>}
                      {r.fileUrl && <a href={r.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:border-[#38bdf8]/30 transition-all"><Eye size={12}/> View Sheet</a>}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </motion.div>
  );
}
