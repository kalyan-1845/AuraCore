"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Shield, Globe, Zap, History, Download, Loader2, CheckCircle, Copy, Cpu, Activity, Terminal, Bot, ChevronRight, Share2 } from "lucide-react";

interface Mission {
  id: number;
  goal: string;
  result: string;
  timestamp: string;
}

interface AgentStatus {
  status: "idle" | "initializing" | "planning" | "researching" | "building" | "completed" | "error";
  message: string;
  result?: string;
  progress: number;
}

export default function Home() {
  const [goal, setGoal] = useState<string>("");
  const [status, setStatus] = useState<AgentStatus>({ status: "idle", message: "SYSTEM_READY", result: "", progress: 0 });
  const [history, setHistory] = useState<Mission[]>([]);
  const [technicalLogs, setTechnicalLogs] = useState<string[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState<boolean>(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    fetchHistory();
    setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [technicalLogs]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("http://localhost:8000/history");
      const data = await res.json();
      setHistory(data);
    } catch (e) {}
  };

  const addLog = (msg: string) => {
    setTechnicalLogs(prev => [...prev.slice(-10), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleLaunch = async (customGoal?: string) => {
    const activeGoal = customGoal || goal;
    if (!activeGoal) return;
    setGoal(activeGoal);
    setTechnicalLogs([]);
    setStatus({ status: "initializing", message: "LAUNCHING_MATRIX", result: "", progress: 10 });
    addLog("Uplink initialized.");
    
    try {
      const res = await fetch("http://localhost:8000/stream-kickoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: activeGoal }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let lastBatch = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.replace("data: ", ""));
            if (data.status === "completed") {
                setStatus({ status: "completed", message: "MISSION_SUCCESS", result: data.result, progress: 100 });
                addLog("Data finalized.");
                fetchHistory();
            } else if (data.status === "building") {
                lastBatch = data.full_text;
                setStatus({ status: "building", message: "PROCESSING_DATA", result: lastBatch, progress: 60 });
            } else {
                setStatus(prev => ({ ...prev, status: data.status, message: data.message.toUpperCase(), progress: 30 }));
                addLog(data.message);
            }
          }
        }
      }
    } catch (e) {
      addLog("Link error.");
      setStatus({ status: "error", message: "DOWNLINK_LOST", result: "", progress: 0 });
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-[#d0d0f0] selection:bg-blue-500/30">
      
      {/* Moving Background */}
      <div className="mesh-bg" />

      {/* Modern Top Nav */}
      <nav className="fixed top-0 left-0 w-full h-16 flex items-center justify-between px-8 z-50 glass border-b border-white/5">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Cpu size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-black italic tracking-tighter text-white">AURA<span className="text-blue-500">CORE</span></h1>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400 hover:text-white transition-all uppercase">
                <History size={14} /> History
            </button>
        </div>
      </nav>

      {/* Archives Modal */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[100] flex justify-center items-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-4xl bg-[#080812] border border-white/10 rounded-[40px] p-10 max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-4xl font-black tracking-tighter text-white">ARCHIVES</h2>
                    <button onClick={() => setSidebarOpen(false)} className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 font-bold transition-all">X</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar flex-1 pb-4">
                    {history.map((m) => (
                        <div key={m.id} onClick={() => { setGoal(m.goal); setStatus({ status: "completed", message: "RESTORED", result: m.result, progress: 100 }); setSidebarOpen(false); }} className="p-8 bg-white/2 hover:bg-blue-600/10 border border-white/5 rounded-[30px] cursor-pointer transition-all group">
                            <span className="text-[10px] text-blue-500 font-bold block mb-4">{new Date(m.timestamp).toLocaleDateString()}</span>
                            <p className="font-bold text-sm leading-relaxed group-hover:text-white transition-colors">{m.goal}</p>
                        </div>
                    ))}
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 mt-20 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col gap-12 z-10">
        
        {/* Main Hero Header */}
        <section className="text-center space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500/20 mb-4">
                <Sparkles size={14} className="text-blue-400" />
                <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400 uppercase">Multi-Agent Intelligence Matrix</span>
            </motion.div>
            <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-none">
                WHAT IS YOUR <br/> <span className="gradient-text">NEXT MISSION?</span>
            </h2>
        </section>

        {/* The Command Bar */}
        <div className="max-w-4xl mx-auto w-full">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-white/2 border border-white/10 rounded-[32px] p-2 flex items-center focus-within:border-blue-500/40 focus-within:bg-blue-500/5 transition-all shadow-2xl">
                    <div className="w-12 h-12 hidden md:flex items-center justify-center text-blue-500/30">
                        <Terminal size={24} />
                    </div>
                    <input 
                        ref={inputRef}
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="Define mission goal..."
                        style={{ color: 'white' }}
                        className="flex-1 bg-transparent border-none py-6 px-4 md:px-2 text-2xl font-bold outline-none placeholder:text-slate-700 caret-blue-500"
                        onKeyDown={(e) => e.key === "Enter" && handleLaunch()}
                    />
                </div>
                <button 
                  onClick={() => handleLaunch()}
                  className="bg-blue-600 text-white px-12 py-8 rounded-[32px] font-black shadow-2xl hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 text-xl tracking-tighter"
                >
                  DEPLOY MISSION <Send size={24} />
                </button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 mt-8">
                {["Target AI Market", "Sustainablity Strategy", "Code Architect"].map(s => (
                    <button key={s} onClick={() => handleLaunch(s)} className="text-[10px] font-bold tracking-[0.3em] text-slate-600 hover:text-white transition-colors uppercase">//{s}</button>
                ))}
            </div>
        </div>

        {/* Results HUB */}
        {(status.status !== "idle" || technicalLogs.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 border-t border-white/5 pt-20">
                
                {/* Tech Log HUD */}
                <div className="md:col-span-1 space-y-6">
                    <header className="flex items-center gap-3">
                        <Activity size={16} className="text-blue-500" />
                        <span className="text-xs font-black tracking-widest uppercase">System Logs</span>
                    </header>
                    <div className="space-y-3">
                        <div className="flex flex-col gap-3">
                            <AgentIcon label="Lead" active={status.status === "planning"} icon={<Shield size={14}/>} />
                            <AgentIcon label="Search" active={status.status === "building" && !status.result} icon={<Globe size={14}/>} />
                            <AgentIcon label="Build" active={status.status === "building" && !!status.result} icon={<Zap size={14}/>} />
                        </div>
                        <div className="h-64 bg-black/40 border border-white/5 rounded-3xl p-6 overflow-y-auto space-y-2 text-[10px] font-mono text-blue-500/40 custom-scrollbar">
                            {technicalLogs.map((log, i) => <div key={i}>{log}</div>)}
                            <div ref={logEndRef} />
                        </div>
                    </div>
                </div>

                {/* The Report Matrix */}
                <div className="md:col-span-3 space-y-8">
                    <header className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${status.status === 'completed' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`} />
                            <h3 className="text-sm font-black tracking-[0.2em] text-blue-400 uppercase">{status.message}</h3>
                        </div>
                        {status.result && (
                            <div className="flex gap-4">
                                <button onClick={() => navigator.clipboard.writeText(status.result!)} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all"><Copy size={16} /></button>
                                <button className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all"><Share2 size={16} /></button>
                            </div>
                        )}
                    </header>
                    
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-[40px] p-12 md:p-20 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-16 opacity-[0.02] -rotate-12 pointer-events-none group-hover:opacity-[0.05] transition-opacity">
                            <Bot size={400} />
                        </div>
                        <div className="relative z-10 intel-report whitespace-pre-wrap font-sans">
                            {status.result || ">_ESTABLISHING_ENCRYPTED_DOWNLINK..."}
                        </div>
                    </motion.div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

function AgentIcon({ label, active, icon }: { label: string; active: boolean, icon: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all ${active ? 'bg-blue-600/10 border-blue-500/40' : 'bg-white/2 border-white/5 opacity-30 font-bold text-slate-800'}`}>
       <div className={`${active ? 'text-blue-400' : 'text-slate-800'}`}>{icon}</div>
       <span className="text-[10px] font-black tracking-widest uppercase">{label}</span>
    </div>
  );
}
