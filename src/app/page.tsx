"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Send, Shield, History as LucideHistory, Download, 
  Loader2, CheckCircle, Copy, Cpu, Activity as LucideActivity, Terminal, 
  Brain, Minimize2, Maximize2, Wifi, Command, Trash2, 
  PlusCircle, Share2, Menu, X, Workflow, ChevronDown
} from "lucide-react";

interface MissionData { id: number; goal: string; result: string; timestamp: string; }
interface AgentStatus { status: "idle" | "initializing" | "planning" | "researching" | "building" | "completed" | "error"; message: string; result?: string; progress: number; }
type AuraVersion = "v5.1" | "v5.2" | "v5.3";

export default function Home() {
  const [goal, setGoal] = useState("");
  const [version, setVersion] = useState<AuraVersion>("v5.1");
  const [status, setStatus] = useState<AgentStatus>({ status: "idle", message: "READY", result: "", progress: 0 });
  const [historyItems, setHistoryItems] = useState<MissionData[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    fetchHistory();
    syncNeuralMemory();
    setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [status.result, status.status]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("http://localhost:8000/history");
      const data = await res.json();
      setHistoryItems(data);
    } catch (e) {}
  };

  const syncNeuralMemory = async () => {
    setIsSyncing(true);
    try {
        await fetch("http://localhost:8000/sync-knowledge", { method: "POST" });
    } catch (e) {}
    setIsSyncing(false);
  };

  const handleLaunch = async (customGoal?: string) => {
    const activeGoal = customGoal || goal;
    if (!activeGoal) return;
    setGoal(""); 
    setStatus({ status: "initializing", message: "UPLINKING...", result: "", progress: 5 });

    const specMap = { "v5.1": "General", "v5.2": "Analyst", "v5.3": "Coder" };

    try {
      const res = await fetch("http://localhost:8000/stream-kickoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: activeGoal, specialization: specMap[version] }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
                const data = JSON.parse(line.replace("data: ", ""));
                if (data.status === "completed") {
                    setStatus({ status: "completed", message: "COMPLETED", result: data.result, progress: 100 });
                    fetchHistory();
                } else if (data.status === "building") {
                    setStatus({ status: "building", message: "SYNTHESIZING", result: data.full_text, progress: 60 });
                }
            } catch (err) {}
          }
        }
      }
    } catch (e) {
      setStatus({ status: "error", message: "FAILED", result: "", progress: 0 });
    }
  };

  const downloadFullIntel = async () => {
    try {
        const res = await fetch("http://localhost:8000/export-knowledge");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AuraCore_Bridge.txt`;
        a.click();
    } catch (e) {}
  };

  return (
    <div className="flex h-screen bg-[#000000] text-slate-200 overflow-hidden font-sans relative">
      <div className="mesh-bg fixed inset-0 z-0" />
      
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="h-full bg-black/60 backdrop-blur-3xl border-r border-white/5 flex flex-col relative z-[200] overflow-hidden shrink-0"
      >
        <div className="p-4 flex flex-col h-full w-[280px]">
          <button 
            onClick={() => setStatus({ status: "idle", message: "READY", result: "", progress: 0 })}
            className="flex items-center gap-3 w-full p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm font-black text-white mb-8 group shadow-2xl"
          >
            <PlusCircle size={18} className="text-cyan-500" />
            NEW MISSION
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
            <div>
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 px-2">Mission History</h3>
                <div className="space-y-1">
                    {historyItems.map(m => (
                    <div key={m.id} className="group relative">
                        <button 
                            onClick={() => setStatus({ status: "completed", message: "RESTORED", result: m.result, progress: 100 })}
                            className="w-full text-left p-3.5 rounded-xl hover:bg-white/5 text-[11px] text-slate-400 hover:text-white transition-all line-clamp-1 border border-transparent pr-10 font-bold"
                        >
                            {m.goal}
                        </button>
                        <button 
                            onClick={async (e) => {
                                e.stopPropagation();
                                await fetch(`http://localhost:8000/delete-mission/${m.id}`, { method: "DELETE" });
                                fetchHistory();
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-lg"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                    ))}
                </div>
            </div>

            <div className="pt-6 border-t border-white/5">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 px-2">Neural Link</h3>
                <div className="space-y-2">
                    <button onClick={downloadFullIntel} className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-cyan-600/5 border border-cyan-500/10 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest group">
                        <Download size={14} className="text-cyan-500" /> Export Bridge
                    </button>
                    {/* RESTORE STATE */}
                    <label className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/2 border border-white/5 hover:border-cyan-500/30 text-slate-400 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest cursor-pointer group">
                        <PlusCircle size={14} className="text-slate-500 group-hover:text-cyan-400" /> Restore State
                        <input type="file" className="hidden" accept=".txt" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = async (ev) => {
                                    const content = ev.target?.result as string;
                                    await fetch("http://localhost:8000/import-knowledge", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ file_path: content })
                                    });
                                    fetchHistory();
                                };
                                reader.readAsText(file);
                            }
                        }} />
                    </label>
                    {/* UNIVERSAL TRAINER */}
                    <label className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/2 border border-white/5 hover:border-cyan-500/30 text-slate-400 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest cursor-pointer group">
                        <Workflow size={14} className="text-cyan-500" /> Train Local File
                        <input type="file" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                await fetch("http://localhost:8000/sync-knowledge", { method: "POST" });
                            }
                        }} />
                    </label>
                </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex items-center gap-3 px-2 shrink-0">
            <img src="/aura-monolith.png" className="w-9 h-9 rounded-xl object-cover border border-white/10 shadow-lg pulse-glow" />
            <div className="flex flex-col">
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">AuraCore Matrix</span>
                <span className="text-[9px] text-cyan-500 font-bold uppercase tracking-[0.3em]">FLUX_V5_ELITE</span>
            </div>
          </div>
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col relative h-full z-10 overflow-hidden">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-black/40 backdrop-blur-sm shrink-0">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-500 transition-all border border-transparent hover:border-white/5">
                <Menu size={22} />
            </button>

            <div className="flex items-center gap-8">
                <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
                    {(["v5.1", "v5.2", "v5.3"] as AuraVersion[]).map(v => (
                        <button 
                            key={v} 
                            onClick={() => setVersion(v)}
                            className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all ${version === v ? 'bg-white/10 text-white shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {v}
                        </button>
                    ))}
                </div>
                <div className="hidden md:flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-cyan-500/5 border border-cyan-500/20">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#00f2ff] animate-pulse"></div>
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.3em]">Flux Intelligence Active</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                 <button onClick={syncNeuralMemory} className={`p-2.5 text-slate-500 hover:text-cyan-400 transition-all ${isSyncing ? 'animate-spin text-cyan-400' : ''}`}>
                    <Wifi size={20}/>
                 </button>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-16 relative pb-48">
            <div className="max-w-4xl mx-auto w-full">
                {status.status === 'idle' ? (
                    <div className="h-[65vh] flex flex-col items-center justify-center text-center space-y-10">
                        <img src="/aura-monolith.png" className="w-20 h-20 rounded-[28px] border border-white/10 shadow-2xl opacity-60 pulse-glow" />
                        <h2 className="text-6xl font-black text-white italic tracking-tighter max-w-2xl leading-[0.9]">Master the Matrix {version}</h2>
                        <div className="flex gap-6 opacity-40">
                            <span className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Proprietary</span>
                            <span className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Real-Time</span>
                            <span className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Offline_Safe</span>
                        </div>
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                        <div className="space-y-3 relative group">
                            <div className="flex items-center gap-4 px-2">
                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 shadow-2xl pulse-glow"><img src="/aura-monolith.png" className="w-full h-full object-cover" /></div>
                                <span className="text-[11px] font-black text-white tracking-[0.3em] uppercase">Intelligence Flow <span className="text-cyan-500">[{version}]</span></span>
                            </div>
                            
                            <div className="intel-report leading-[1.7] bg-white/[0.02] p-6 md:p-10 rounded-[38px] border border-white/[0.04] shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] glass-card">
                                <div className="markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {status.result || ""}
                                    </ReactMarkdown>
                                </div>
                                {!status.result && <div className="flex items-center gap-3 text-cyan-500 animate-pulse font-black text-[9px] tracking-[0.2em] italic uppercase"><Loader2 size={12} className="animate-spin" /> Uplink Synchronizing...</div>}
                                
                                {status.result && (
                                    <div className="flex gap-4 mt-12 pt-8 border-t border-white/5">
                                        <button onClick={() => navigator.clipboard.writeText(status.result || "")} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-white/5 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 transition-all border border-white/5 text-[10px] font-black uppercase tracking-widest shadow-xl">
                                            <Copy size={16}/> Copy
                                        </button>
                                        <button onClick={() => {
                                            const blob = new Blob([status.result || ""], { type: 'text/markdown' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `AuraCore_Intel_${Date.now()}.md`;
                                            a.click();
                                        }} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-white/5 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 transition-all border border-white/5 text-[10px] font-black uppercase tracking-widest shadow-xl">
                                            <Download size={16}/> Save Markdown
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
                <div ref={chatEndRef} className="h-10" />
            </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 z-[150] pointer-events-none">
            <div className="max-w-4xl mx-auto w-full pointer-events-auto">
                <div className="relative flex items-center bg-[#0d0d12]/98 border border-white/10 rounded-[30px] p-2 pr-5 shadow-[0_40px_100px_-20px_rgba(0,0,0,1)]">
                    <input
                        ref={inputRef}
                        value={goal}
                        onChange={e => setGoal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLaunch()}
                        className="flex-1 bg-transparent border-none outline-none text-base md:text-xl text-white placeholder:text-slate-800 px-8 py-3.5 font-medium"
                        placeholder={`Message AuraCore Elite ${version}...`}
                    />
                    <button 
                        onClick={() => handleLaunch()} 
                        disabled={!goal || (status.status !== 'idle' && status.status !== 'completed' && status.status !== 'error')} 
                        className="p-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/5 text-white rounded-[24px] transition-all shadow-2xl shadow-cyan-600/30"
                    >
                        {status.status === 'building' ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                    </button>
                </div>
                <p className="text-center mt-4 text-[8px] font-black text-slate-700 uppercase tracking-[0.6em]">Aura Matrix Orchestration // v5.13 // Encrypted // Private</p>
            </div>
        </div>
      </div>
    </div>
  );
}
