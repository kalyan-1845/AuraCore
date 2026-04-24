"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

    // Map versions to internal specializations
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

  const addLog = (msg: string) => console.log(`[AuraCore] ${msg}`);

  return (
    <div className="flex h-screen bg-[#020206] text-slate-200 overflow-hidden font-sans relative">
      <div className="mesh-bg fixed inset-0 z-0" />
      
      {/* ChatGPT-Style Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="h-full bg-black/40 backdrop-blur-3xl border-r border-white/5 flex flex-col relative z-[200] overflow-hidden shrink-0"
      >
        <div className="p-4 flex flex-col h-full w-[280px]">
          <button 
            onClick={() => setStatus({ status: "idle", message: "READY", result: "", progress: 0 })}
            className="flex items-center gap-3 w-full p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-bold text-white mb-6 group"
          >
            <PlusCircle size={18} className="text-blue-500" />
            New Mission
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
            <div>
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 px-2">Mission History</h3>
                <div className="space-y-1">
                    {historyItems.map(m => (
                    <button 
                        key={m.id} 
                        onClick={() => setStatus({ status: "completed", message: "RESTORED", result: m.result, progress: 100 })}
                        className="w-full text-left p-3 rounded-xl hover:bg-white/5 text-xs text-slate-400 hover:text-white transition-all line-clamp-1 border border-transparent hover:border-white/5"
                    >
                        {m.goal}
                    </button>
                    ))}
                </div>
            </div>

            <div className="pt-4 border-t border-white/5">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 px-2">Neural Portability</h3>
                <div className="space-y-2">
                    <button onClick={downloadFullIntel} className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-600/5 border border-blue-500/10 hover:border-blue-500/50 text-slate-300 hover:text-white transition-all text-[11px] font-bold group">
                        <Download size={14} className="text-blue-500" /> Export State
                    </button>
                    <label className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/2 border border-white/5 hover:border-blue-500/30 text-slate-400 hover:text-white transition-all text-[11px] font-bold cursor-pointer group">
                        <PlusCircle size={14} className="text-slate-500 group-hover:text-blue-400" /> Restore State
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
                </div>
            </div>

            <div className="pt-4 border-t border-white/5 pb-10">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 px-2">Universal Trainer</h3>
                <label className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/2 border border-white/5 hover:border-cyan-500/30 text-slate-400 hover:text-white transition-all text-[11px] font-bold cursor-pointer group">
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

          <div className="pt-4 border-t border-white/5 flex items-center gap-3 px-2 shrink-0 bg-black/5 rounded-t-2xl">
            <img src="/aura-monolith.png" className="w-8 h-8 rounded-lg object-cover border border-white/10 shadow-lg pulse-glow" />
            <div className="flex flex-col">
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">AuraCore Matrix</span>
                <span className="text-[9px] text-blue-500 font-bold uppercase tracking-widest">STABLE_V5</span>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative h-full z-10 overflow-hidden">
        
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-sm shrink-0">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all">
                <Menu size={20} />
            </button>

            {/* ChatGPT-Style Version Switcher */}
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
                {(["v5.1", "v5.2", "v5.3"] as AuraVersion[]).map(v => (
                    <button 
                        key={v} 
                        onClick={() => setVersion(v)}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${version === v ? 'bg-white/10 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {v}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-4">
                 <button onClick={syncNeuralMemory} className={`p-2 text-slate-500 hover:text-white transition-all ${isSyncing ? 'animate-spin text-blue-500' : ''}`}>
                    <Wifi size={18}/>
                 </button>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 relative pb-40">
            <div className="max-w-3xl mx-auto w-full">
                {status.status === 'idle' ? (
                    <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
                        <img src="/aura-monolith.png" className="w-16 h-16 rounded-2xl border border-white/10 shadow-2xl opacity-20" />
                        <h2 className="text-4xl font-black text-white italic tracking-tighter max-w-lg">How can AuraCore {version} help you?</h2>
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10"><img src="/aura-monolith.png" className="w-full h-full object-cover" /></div>
                                <span className="text-[11px] font-black text-white tracking-widest uppercase">Intelligence Flow <span className="text-blue-500">[{version}]</span></span>
                            </div>
                            <div className="intel-report leading-relaxed">
                                {status.result || <div className="flex items-center gap-2 text-blue-500 animate-pulse font-mono text-xs italic"><Loader2 size={14} className="animate-spin" /> Synthesizing Data...</div>}
                            </div>
                            {status.result && (
                                <div className="flex gap-2">
                                    <button onClick={() => navigator.clipboard.writeText(status.result || "")} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 transition-all"><Copy size={16}/></button>
                                    <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 transition-all"><Download size={16}/></button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
                <div ref={chatEndRef} className="h-10" />
            </div>
        </div>

        {/* Bottom Input Area */}
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 z-[150] pointer-events-none">
            <div className="max-w-3xl mx-auto w-full pointer-events-auto">
                <div className="relative flex items-center bg-[#0d0d12]/95 border border-white/10 rounded-[28px] p-2 pr-4 shadow-[0_30px_70px_-15px_rgba(0,0,0,1)]">
                    <input
                        ref={inputRef}
                        value={goal}
                        onChange={e => setGoal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLaunch()}
                        className="flex-1 bg-transparent border-none outline-none text-base md:text-lg text-white placeholder:text-slate-800 px-6 py-3"
                        placeholder={`Message AuraCore ${version}...`}
                    />
                    <button 
                        onClick={() => handleLaunch()} 
                        disabled={!goal || (status.status !== 'idle' && status.status !== 'completed' && status.status !== 'error')} 
                        className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 text-white rounded-[22px] transition-all shadow-xl shadow-blue-600/20"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
