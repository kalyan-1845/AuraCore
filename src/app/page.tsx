"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Zap, Globe, Shield, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface AgentStatus {
  status: "idle" | "initializing" | "planning" | "researching" | "building" | "completed" | "error";
  message: string;
  result?: string;
}

export default function Home() {
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState<AgentStatus>({ status: "idle", message: "Ready to launch..." });
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleLaunch = async () => {
    if (!goal) return;
    
    setLogs([]);
    setStatus({ status: "initializing", message: "Hiring the Agent Crew..." });
    
    try {
      const response = await fetch("http://localhost:8000/stream-kickoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.replace("data: ", ""));
            
            if (data.status === "completed") {
              setStatus({ status: "completed", message: "Success!", result: data.result });
            } else if (data.status === "error") {
              setStatus({ status: "error", message: data.message });
            } else {
              setStatus((prev) => ({ ...prev, status: data.status, message: data.message }));
              setLogs((prev) => [...prev, data.message]);
            }
          }
        }
      }
    } catch (error) {
      setStatus({ status: "error", message: "Connection failed. Is the backend running?" });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-24 bg-[#05050f] text-white overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl space-y-12"
      >
        <header className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="flex justify-center"
          >
            <div className="glass p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 shadow-lg shadow-blue-500/10">
              <Bot size={48} className="text-blue-400" />
            </div>
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Aura<span className="gradient-text">Agent</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            The next-generation multi-agent orchestrator. Transform high-level ideas into actionable reality using an autonomous digital workforce.
          </p>
        </header>

        <div className="glass p-6 md:p-8 rounded-3xl space-y-6">
          <div className="relative group">
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="E.g., 'Analyze 2026 sustainability trends and build an action plan'"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-lg placeholder:text-slate-500"
              onKeyDown={(e) => e.key === "Enter" && handleLaunch()}
            />
            <button 
              onClick={handleLaunch}
              className="absolute right-3 top-3 p-3 bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors shadow-lg shadow-blue-500/30"
            >
              <Send size={24} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={<Shield className="text-blue-400" />} title="Strategist" active={status.status === "planning"} />
            <StatCard icon={<Globe className="text-purple-400" />} title="Researcher" active={status.status === "researching"} />
            <StatCard icon={<Zap className="text-pink-400" />} title="Executive" active={status.status === "building"} />
          </div>
        </div>

        <AnimatePresence>
          {status.status !== "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="glass rounded-3xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {status.status === "completed" ? (
                    <CheckCircle className="text-green-400" />
                  ) : status.status === "error" ? (
                    <AlertCircle className="text-red-400" />
                  ) : (
                    <Loader2 className="animate-spin text-blue-400" />
                  )}
                  <h2 className="text-xl font-semibold capitalize">{status.status}...</h2>
                </div>
                <span className="text-slate-400 text-sm font-mono">{status.message}</span>
              </div>

              {status.result ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="prose prose-invert max-w-none bg-black/30 p-8 rounded-2xl border border-white/5 font-mono text-sm leading-relaxed whitespace-pre-wrap"
                >
                  {status.result}
                </motion.div>
              ) : (
                <div 
                  ref={scrollRef}
                  className="h-64 overflow-y-auto space-y-2 font-mono text-sm text-slate-400 bg-black/20 p-4 rounded-xl border border-white/5 scroll-smooth"
                >
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-blue-500/50">[{new Date().toLocaleTimeString()}]</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  <div className="animate-pulse flex gap-4">
                     <span className="text-blue-500/50">[{new Date().toLocaleTimeString()}]</span>
                     <span>Thinking...</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

function StatCard({ icon, title, active }: { icon: React.ReactNode; title: string, active: boolean }) {
  return (
    <div className={`agent-card glass p-4 rounded-2xl flex items-center gap-4 border-l-4 ${active ? 'border-l-blue-500 bg-blue-500/10' : 'border-l-transparent'}`}>
      <div className="p-2 bg-white/5 rounded-xl">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className={`text-xs ${active ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`}>
          {active ? 'Busy' : 'Standby'}
        </span>
      </div>
    </div>
  );
}
