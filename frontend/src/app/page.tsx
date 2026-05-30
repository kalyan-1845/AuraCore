"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { 
  Send, Shield, History as LucideHistory, Download, 
  Loader2, CheckCircle, Copy, Cpu, Activity as LucideActivity, Terminal, 
  Brain, Minimize2, Maximize2, Wifi, Command, Trash2, 
  PlusCircle, Share2, Menu, X, Workflow, ChevronDown, Sparkles, Database, Search, 
  Camera, Eye, Layers, Square, RotateCcw, Zap, Globe, Building2, FileText
} from "lucide-react";

interface MissionData { id: number; goal: string; result: string; timestamp: string; }
interface AgentStatus { status: "idle" | "initializing" | "planning" | "researching" | "building" | "thinking" | "completed" | "error"; message: string; result?: string; progress: number; }
export type AuraVersion = "v5.5-Flux" | "v5.5-Analyst" | "v5.5-Coder" | "v5.5-RedTeam";
interface TraceShard { source: string; content: string; }
interface ThinkLoopData { iteration: number; max_iterations: number; phase: string; score?: number; verdict?: string; weaknesses?: string[]; }

const API_BASE = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000") : "http://127.0.0.1:8000";
let notificationCounter = 0;

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [goal, setGoal] = useState("");
  const [version, setVersion] = useState<AuraVersion>("v5.5-Flux");
  const [status, setStatus] = useState<AgentStatus>({ status: "idle", message: "READY", result: "", progress: 0 });
  const [historyItems, setHistoryItems] = useState<MissionData[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFileContent, setAttachedFileContent] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState({ load: "0.22ms", missions: 0, shards: 0 });
  const [historyCache, setHistoryCache] = useState<Record<number, string>>({});
  const [currentGoal, setCurrentGoal] = useState("");
  const [traceShards, setTraceShards] = useState<TraceShard[]>([]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<{id: number, msg: string}[]>([]);
  const [thinkLoop, setThinkLoop] = useState<ThinkLoopData | null>(null);
  const [activeModel, setActiveModel] = useState<string>("llama3");
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [availableModels, setAvailableModels] = useState<{name: string, warmed: boolean}[]>([]);
  const [license, setLicense] = useState({ valid: true, message: "CHECKING...", status: "PENDING", owner: "", expiry: "", days_left: 0 });
  const [licOwner, setLicOwner] = useState("");
  const [licKey, setLicKey] = useState("");
  const [licExpiry, setLicExpiry] = useState("");
  const [licError, setLicError] = useState("");

  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Live timer effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 100);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  useEffect(() => { 
    const bootSequence = async () => {
      // STAGGERED BOOT: prevents startup storm
      try {
        // Step 1: Check license (fast, doesn't hit Ollama)
        try {
          const res = await fetch(`${API_BASE}/license-status`);
          const data = await res.json();
          setLicense(data);
        } catch (e) {
          setLicense({ valid: true, message: "BACKEND_STARTING", status: "DEV", owner: "", expiry: "", days_left: 0 });
        }

        // Step 2: Load history (fast, only hits SQLite)
        await fetchHistory();

        // Step 3: Check if backend is alive before heavy calls
        try {
          const healthRes = await fetch(`/api/health`);
          const healthData = await healthRes.json();
          if (healthData.api === "ok") {
            setIsOnline(true);
            // Step 4: Only fetch models if backend is alive
            await fetchModels();
            // Step 5: Check if model is warmed up and ready
            try {
              const warmupRes = await fetch(`/api/warmup-status`);
              const warmupData = await warmupRes.json();
              setIsModelReady(warmupData.ready === true);
              if (!warmupData.ready) {
                addNotification("MODEL_LOADING_INTO_RAM...");
                // Poll warmup status every 5s until ready
                const warmupPoll = setInterval(async () => {
                  try {
                    const r = await fetch(`/api/warmup-status`);
                    const d = await r.json();
                    if (d.ready) {
                      setIsModelReady(true);
                      addNotification(`MODEL_READY: ${d.model}`);
                      clearInterval(warmupPoll);
                    }
                  } catch (e) {}
                }, 5000);
                // Stop polling after 3 minutes max
                setTimeout(() => clearInterval(warmupPoll), 180000);
              } else {
                addNotification(`MODEL_READY: ${warmupData.model}`);
              }
            } catch (e) {
              // If warmup endpoint doesn't exist, assume ready
              setIsModelReady(true);
            }
            // Step 6: Sync knowledge in background (delayed, non-blocking)
            setTimeout(() => syncNeuralMemory(), 5000);
          } else {
            setIsOnline(false);
          }
        } catch (e) {
          setIsOnline(false);
          console.warn("Backend not ready yet. Heartbeat will retry.");
        }
      } catch (e) {
        console.error("BOOT_SEQUENCE_ERROR:", e);
      }

      addNotification("SYSTEM_RECOVERY_COMPLETE");
      setTelemetry(prev => ({ 
        ...prev,
        load: `0.${Math.floor(Math.random() * 99)}ms`
      }));
      setTimeout(() => inputRef.current?.focus(), 500);
    };

    bootSequence();
  }, []);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            setIsPaletteOpen(prev => !prev);
        }
        if (e.key === 'Escape') setIsPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [status.result, status.status]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      const list = await res.json();
      setHistoryItems(list);
      setTelemetry(prev => ({ ...prev, missions: list.length }));
      
      const kRes = await fetch(`${API_BASE}/export-knowledge`);
      const kText = await kRes.text();
      const shardsCount = (kText.match(/SOURCE:/g) || []).length;
      setTelemetry(prev => ({ ...prev, shards: shardsCount }));

      // History details are lazy-loaded when clicked (no bulk fetch)
    } catch (e) {
      console.error("HISTORY_WARMUP_FAILED", e);
    }
  };

  const syncNeuralMemory = async () => {
    setIsSyncing(true);
    try {
        const res = await fetch(`${API_BASE}/sync-knowledge`, { method: "POST" });
        if (res.ok) {
            setIsOnline(true);
            addNotification("NEURAL_SYNC_COMPLETE");
        } else {
            throw new Error("SYNC_FAILED");
        }
    } catch (e) { 
        setIsOnline(false); 
        console.warn("SYNC_FAILURE: Backend might be starting up...");
    }
    setIsSyncing(false);
  };

  // Connection Heartbeat (relaxed: every 10s instead of 5s)
  useEffect(() => {
    const heartbeat = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/health`);
            if (res.ok) {
                const data = await res.json();
                const ollamaOk = data.ollama === "ok";
                const apiOk = data.api === "ok";
                setIsOnline(apiOk && ollamaOk);
                if (!ollamaOk && apiOk) {
                    console.warn("[HEARTBEAT] Backend up but Ollama unreachable");
                }
                // Also check warmup status periodically
                if (apiOk && !isModelReady) {
                  try {
                    const wr = await fetch(`${API_BASE}/warmup-status`);
                    const wd = await wr.json();
                    if (wd.ready) setIsModelReady(true);
                  } catch (e) {}
                }
            }
        } catch (e) {
            setIsOnline(false);
        }
    }, 10000);
    return () => clearInterval(heartbeat);
  }, [isModelReady]);

  const fetchModels = async () => {
    try {
      const res = await fetch(`${API_BASE}/models`);
      const data = await res.json();
      setAvailableModels(data.models || []);
      if (data.models?.length > 0) setActiveModel(data.models[0].name);
    } catch (e) {
      console.error("MODEL_DISCOVERY_FAILED", e);
    }
  };

  const addNotification = (msg: string) => {
    const id = ++notificationCounter;
    setNotifications(prev => [...prev, { id, msg }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
  };

  const stopMission = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setStatus(prev => ({ ...prev, status: "error", message: "ABORTED", progress: 0 }));
    }
  };

  const handleLaunch = async (customGoal?: string) => {
    const activeGoal = customGoal || goal;
    if (!activeGoal) return;
    console.log("[AURACORE] MISSION_LAUNCHED: ", activeGoal);
    
    setGoal(""); 
    setCurrentGoal(activeGoal);
    setIsTraceOpen(false);
    setAttachedImage(null);
    setStatus({ status: "initializing", message: "CORE_IGNITION_ACTIVE", result: "", progress: 2 });
    setThinkLoop(null);
    setElapsedTime(0);
    setTimerRunning(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const specMap = { 
      "v5.5-Flux": "General", 
      "v5.5-Analyst": "Analyst", 
      "v5.5-Coder": "Coder", 
      "v5.5-RedTeam": "RedTeam"
    };

    try {
      addNotification("MISSION_ENGAGED");
      const res = await fetch(`${API_BASE}/stream-kickoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({ 
            goal: activeGoal, 
            specialization: specMap[version],
            image: attachedImage,
            file_data: attachedFileContent,
            history: historyItems
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.trim().startsWith("data: ")) {
            try {
                const data = JSON.parse(line.trim().replace("data: ", ""));
                if (data.status === "completed") {
                    setThinkLoop(null);
                    setTimerRunning(false);
                    setStatus({ status: "completed", message: "COMPLETED", result: data.result, progress: 100 });
                    addNotification("SYNTHESIS_COMPLETE");
                    fetchHistory();
                    abortControllerRef.current = null;
                } else if (data.status === "building") {
                    const msg = data.message || "SYNTHESIZING";
                    const prog = data.progress || 60;
                    // FIX: Preserve the existing result if data.full_text is missing (status updates)
                    setStatus(prev => ({ 
                      ...prev, 
                      status: "building", 
                      message: msg, 
                      result: data.full_text ?? prev.result, 
                      progress: prog 
                    }));
                } else if (data.status === "trace") {
                    setTraceShards(data.shards);
                } else if (data.status === "thinking") {
                    const td = data.think_data;
                    setThinkLoop(td);
                    if (data.message === 'DEEP_REASONING_CALIBRATION_94') {
                      addNotification("94% DEPTH_REASONING_ACTIVE");
                    }
                    setStatus(prev => ({ 
                      ...prev, 
                      status: "thinking", 
                      message: `NEURAL_DEBATE (${td.iteration}/${td.max_iterations}) - ${td.phase}`, 
                      progress: data.progress || 60 + (td.iteration * 10) 
                    }));
                }
            } catch (parseErr) {
                  console.warn("[SSE_PARSE] Failed to parse chunk:", line.trim().substring(0, 100), parseErr);
                }
          }
        }
      }
    } catch (e: any) {
      setTimerRunning(false); // Fix: Stop timer on error/abort
      if (e.name === 'AbortError') return;
      const errorMsg = e.message || "Unknown error";
      console.error("[MISSION_ERROR]", errorMsg);
      addNotification(`ERROR: ${errorMsg.substring(0, 50)}`);
      setStatus({ status: "error", message: errorMsg.substring(0, 80), result: "", progress: 0 });
    }
  };

  const downloadFullIntel = async () => {
    try {
        const res = await fetch(`/api/export-knowledge`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AuraCore_Bridge.txt`;
        a.click();
        addNotification("BRIDGE_EXPORTED");
    } catch (e) {
        addNotification("EXPORT_FAILED");
    }
  };

  const downloadMissionReport = async () => {
    if (!status.result) return;
    try {
      addNotification("GENERATING_PDF...");
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.querySelector('.intel-report');
      if (!element) return;
      
      const opt = {
        margin: [15, 15, 15, 15] as [number, number, number, number],
        filename: `AuraCore_Elite_Report_${Date.now()}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#09090b' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };
      
      await html2pdf().set(opt).from(element as HTMLElement).save();
      addNotification("PDF_EXPORT_COMPLETE");
    } catch (e) {
      addNotification("PDF_EXPORT_FAILED");
      console.error(e);
    }
  };

  const filteredHistory = historyItems.filter(h => h.goal.toLowerCase().includes(historySearch.toLowerCase()));

  const starters = [
    { label: "Analyze Project Code", icon: <Terminal size={14} /> },
    { label: "Market Intelligence", icon: <Database size={14} /> },
    { label: "Debug Logic Failure", icon: <Shield size={14} /> },
    { label: "Design Vision", icon: <Sparkles size={14} /> }
  ];

  if (!mounted) return <div className="flex h-screen w-full bg-[#020617]" />;

  return (
    <div className={`flex h-screen bg-[#000000] text-slate-200 font-sans relative transition-all duration-1000 ${status.status === 'building' ? 'bg-[#020617]' : 'bg-[#000000]'}`}>
      <div className={`mesh-bg fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${status.status === 'building' ? 'opacity-80' : 'opacity-40'}`} style={{ animation: status.status === 'building' ? 'neural-pulse 2s infinite ease-in-out' : 'neural-pulse 8s infinite ease-in-out' }} />
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 0, 
          opacity: isSidebarOpen ? 1 : 0,
          x: isSidebarOpen ? 0 : -20
        }}
        className={`h-full bg-black/90 backdrop-blur-3xl border-r border-white/5 flex flex-col fixed md:relative z-[200] overflow-hidden shrink-0 shadow-[20px_0_100px_rgba(0,0,0,0.8)] transition-all`}
      >
        <div className="p-5 flex flex-col h-full w-[280px]">
          <button 
            onClick={() => setStatus({ status: "idle", message: "READY", result: "", progress: 0 })}
            className="flex items-center gap-3 w-full p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-[11px] font-black text-white mb-8 group shadow-2xl btn-premium"
          >
            <PlusCircle size={16} className="text-cyan-500" />
            INITIALIZE NEW MISSION
          </button>

          <div className="mb-6 px-1">
             <div className="relative flex items-center bg-white/2 border border-white/5 rounded-xl px-3 py-2 group focus-within:border-cyan-500/30 transition-all">
                <Search size={14} className="text-slate-600 group-focus-within:text-cyan-500 transition-colors" />
                <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-[11px] text-white placeholder:text-slate-700 px-3" placeholder="Identify previous missions..." />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
            <div>
                <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ">Mission History</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchHistory} className="p-1 text-slate-700 hover:text-cyan-500 transition-all opacity-40 hover:opacity-100">
                            <LucideHistory size={12} />
                        </button>
                        <button 
                            onClick={async () => {
                                if (confirm("Wipe all Neural Records?")) {
                                    await fetch(`${API_BASE}/history`, { method: "DELETE" });
                                    fetchHistory();
                                }
                            }}
                            className="p-1 text-slate-700 hover:text-red-500 transition-all opacity-40 hover:opacity-100"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
                <div className="space-y-1">
                    {filteredHistory.map((m, idx) => (
                    <div key={`mission-v2-${idx}-${m.goal.substring(0, 10)}`} className="group relative flex items-center gap-1">
                        <button 
                            onClick={async () => {
                                setIsTraceOpen(false);
                                if (historyCache[m.id]) {
                                    setStatus({ status: "completed", message: "RESTORED", result: historyCache[m.id], progress: 100 });
                                    return;
                                }
                                setStatus({ status: "initializing", message: "RECALLING", result: "", progress: 20 });
                                try {
                                    const res = await fetch(`${API_BASE}/history?id=${m.id}`);
                                    const data = await res.json();
                                    setHistoryCache(prev => ({ ...prev, [m.id]: data.result }));
                                    setCurrentGoal(m.goal);
                                    setStatus({ status: "completed", message: "RESTORED", result: data.result, progress: 100 });
                                } catch (e) {
                                    setStatus({ status: "error", message: "RECALL_FAILED", result: "", progress: 0 });
                                }
                            }}
                            className="flex-1 text-left p-3.5 rounded-xl hover:bg-white/5 text-[11px] text-slate-400 hover:text-white transition-all line-clamp-1 border border-transparent font-bold"
                        >
                            {m.goal}
                        </button>
                        <button 
                            onClick={async (e) => {
                                e.stopPropagation();
                                if(confirm("Vanish this neural record?")) {
                                    setHistoryItems(prev => prev.filter(item => item.id !== m.id));
                                    await fetch(`${API_BASE}/delete-mission/${m.id}`, { method: "DELETE" });
                                }
                            }}
                            className="p-2 text-slate-700 hover:text-red-500 transition-all hover:bg-red-500/10 rounded-lg shrink-0"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>))}
                </div>
            </div>

            <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between px-4">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Neural Nodes</h3>
                  <span className="text-[9px] font-medium text-cyan-500/70">{availableModels.filter(m => m.warmed).length} Active</span>
                </div>
                <div className="space-y-1 px-2">
                  {availableModels.slice(0, 6).map((m, i) => (
                    <div key={`model-${m.name}-${i}`} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 group transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${m.warmed ? 'bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse' : 'bg-slate-700'}`} />
                        <span className={`text-[11px] font-medium ${m.warmed ? 'text-slate-200' : 'text-slate-500'}`}>{m.name.split(':')[0]}</span>
                      </div>
                      {m.warmed && <span className="text-[8px] font-black text-cyan-500/50 uppercase">Warm</span>}
                    </div>
                  ))}
                </div>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-4">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-2 mb-2">Telemetry</h3>
                <div className="grid grid-cols-3 gap-2 px-2 h-10 items-end">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="flex flex-col gap-1 items-center h-full justify-end">
                            <div className="w-1.5 bg-cyan-500/40 rounded-t-sm telemetry-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col gap-2 px-2 text-[8px] font-mono text-slate-600 uppercase">
                    <div className="flex justify-between"><span>Neural Load</span><span className="text-cyan-500/60">{telemetry.load}</span></div>
                    <div className="flex justify-between"><span>Mission Bank</span><span className="text-cyan-500/60">{telemetry.missions} RECORDS</span></div>
                    <div className="flex justify-between"><span>Neural Depth</span><span className="text-cyan-500/60">{telemetry.shards} LAYERS</span></div>
                </div>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-2">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 px-2">Neural Link</h3>
                <button onClick={downloadFullIntel} className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-cyan-600/5 border border-cyan-500/10 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest group"><Download size={14} className="text-cyan-500" /> Export Bridge</button>
                <label className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/2 border border-white/5 hover:border-cyan-500/30 text-slate-400 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest cursor-pointer group"><PlusCircle size={14} className="text-slate-500 group-hover:text-cyan-400" /> Restore State<input type="file" className="hidden" accept=".txt" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = async (ev) => { const content = ev.target?.result as string; await fetch(`${API_BASE}/import-knowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_path: content }) }); fetchHistory(); }; reader.readAsText(file); } }} /></label>
                <label className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/2 border border-white/5 hover:border-cyan-500/30 text-slate-400 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest cursor-pointer group"><Workflow size={14} className="text-cyan-500" /> Train File<input type="file" className="hidden" onChange={async (e) => { 
                    const file = e.target.files?.[0]; 
                    if (file) { 
                        const formData = new FormData();
                        formData.append("file", file);
                        await fetch(`${API_BASE}/ingest`, { method: "POST", body: formData }); 
                        fetchHistory(); 
                    } 
                }} /></label>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex items-center justify-between px-2 shrink-0">
            <div className="flex items-center gap-3">
                <motion.img animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 4, repeat: Infinity }} src="/aura-monolith.png" className="w-9 h-9 rounded-xl object-cover border border-white/10 shadow-lg pulse-glow" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">AuraCore Matrix</span>
                    <span className={`text-[9px] font-bold uppercase tracking-[0.3em] ${isOnline ? 'text-emerald-400' : isSyncing ? 'text-orange-400' : 'text-slate-600'}`}>
                        {isOnline ? 'FLUX_ONLINE' : isSyncing ? 'INITIALIZING_NEURAL_LINK...' : 'FLUX_OFFLINE'}
                    </span>
                </div>
            </div>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : isSyncing ? 'bg-orange-400 animate-pulse' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
          </div>
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col relative h-full z-10 overflow-hidden">
        <div className="bg-cyan-500 text-black text-[10px] font-black py-1 text-center uppercase tracking-[0.5em] animate-pulse">AURACORE_ELITE_LINK_ESTABLISHED</div>
        <header className="h-12 border-b border-white/5 flex items-center justify-between px-6 bg-black/90 backdrop-blur-3xl shrink-0 sticky top-0 z-[140]">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 transition-all">
                {isSidebarOpen ? <X size={16} /> : <Menu size={18} />}
            </button>
            <div className="flex-1 flex justify-center items-center">
                <div className="flex items-center gap-0.5 p-0.5 bg-white/2 border border-white/5 rounded-lg">
                        {(["v5.5-Flux", "v5.5-Analyst", "v5.5-Coder", "v5.5-RedTeam"] as AuraVersion[]).map((v, vIdx) => (
                            <button key={`mode-btn-${v}-${vIdx}`} onClick={() => setVersion(v)} className={`px-4 py-1 rounded-md text-[8px] font-black tracking-widest transition-all duration-300 ${version === v ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-600 hover:text-slate-300 hover:bg-white/5'}`}>{v.split('-')[1]}</button>
                        ))}
                </div>
            </div>
            <div className="flex items-center gap-3">
                 {(timerRunning || elapsedTime > 0) && (
                   <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${timerRunning ? 'bg-orange-500/10 border-orange-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                     <Zap size={10} className={timerRunning ? 'text-orange-400 animate-pulse' : 'text-emerald-400'} />
                     <span className={`text-[9px] font-mono font-black tracking-wider ${timerRunning ? 'text-orange-400' : 'text-emerald-400'}`}>
                       {(elapsedTime / 1000).toFixed(1)}s
                     </span>
                   </div>
                 )}
                 <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.status === 'idle' || status.status === 'completed' ? 'bg-cyan-500' : 'bg-orange-500 animate-pulse'}`}></div>
                    <span className="text-[7px] font-black text-white uppercase tracking-widest">{status.message}</span>
                 </div>
                 <button onClick={syncNeuralMemory} className={`p-1.5 transition-all ${isOnline ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-600'} ${isSyncing ? 'animate-spin' : 'hover:text-white'}`}>
                    <Wifi size={14}/>
                 </button>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 relative pb-16">
            <div className="max-w-6xl mx-auto w-full">
                {status.status === 'idle' ? (
                    <div className="flex flex-col items-center justify-start pt-2 text-center space-y-4">
                        <div className="flex items-center gap-4 md:gap-8 mb-6">
                            <motion.div
                                animate={{ 
                                    rotate: [0, 90, 180, 270, 360],
                                    scale: [1, 1.1, 1]
                                }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                className="relative"
                            >
                                <div className={`absolute inset-0 ${isModelReady ? 'bg-cyan-500/20' : 'bg-orange-500/20'} blur-2xl rounded-full`} />
                                {isModelReady ? (
                                  <Brain size={48} className="text-cyan-500 relative z-10 pulse-glow" />
                                ) : (
                                  <Loader2 size={48} className="text-orange-400 relative z-10 animate-spin" />
                                )}
                            </motion.div>
                            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tighter leading-none text-left">
                                <span className="opacity-40 font-light block text-sm md:text-base tracking-widest mb-1 uppercase">AURACORE ELITE</span>
                                {isModelReady ? 'SYSTEM_OPERATIONAL' : 'LOADING_MODEL...'}
                            </h2>
                        </div>
                        {!isModelReady && (
                          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                            <Loader2 size={14} className="animate-spin" />
                            Pre-loading AI model into RAM... This takes 30-60 seconds on first boot.
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                            {starters.map((s, idx) => (
                                <button 
                                    key={`starter-btn-${idx}-${s.label.replace(/\s+/g, '-')}`} 
                                    onClick={() => {
                                        setGoal(s.label);
                                        inputRef.current?.focus();
                                    }} 
                                    className="flex items-center gap-3 p-3 bg-white/2 border border-white/5 hover:border-cyan-500/30 hover:bg-white/5 transition-all rounded-2xl text-left group shadow-lg"
                                >
                                    <div className="p-2 bg-white/5 rounded-lg text-slate-600 group-hover:text-cyan-400 transition-colors">{s.icon}</div>
                                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-white transition-colors">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 py-0.5">
                        {/* User Goal Bubble - NANO REFINED */}
                        <motion.div 
                            initial={{ opacity: 0, y: 2, scale: 0.99 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            key={currentGoal}
                            className="flex flex-col items-end gap-1 pr-2"
                        >
                            <div className="px-1.5 py-0.5 rounded-sm bg-cyan-500/5 border border-cyan-500/10">
                                <span className="text-[7px] font-black uppercase tracking-tighter text-cyan-400/40">GOAL_UPLINK</span>
                            </div>
                            <div className="px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.03] text-white/60 text-[9px] font-medium max-w-[60%] whitespace-pre-wrap leading-tight">
                                {currentGoal}
                            </div>
                        </motion.div>
                        
                        <div className="space-y-3 relative group">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-6 h-6 rounded-lg overflow-hidden border border-white/20 shadow-2xl pulse-glow"><img src="/aura-monolith.png" className="w-full h-full object-cover" /></div>
                                <span className="text-[9px] font-black text-white tracking-[0.2em] uppercase">Intelligence Flow <span className="text-cyan-500">[{version}]</span></span>
                                {currentGoal.length > 20 && <span className="text-[8px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full animate-pulse ml-4">MISSION_PROTOCOL_ENGAGED</span>}
                                {status.status === 'completed' && (
                                    <div className="flex-1 flex justify-end">
                                        <button onClick={downloadMissionReport} className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-500/30 text-[9px] font-black text-slate-400 hover:text-white transition-all">
                                            <Download size={10} /> DOWNLOAD_REPORT
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="intel-report leading-[1.6] bg-[#09090b]/80 backdrop-blur-xl p-4 md:p-8 rounded-2xl border border-white/[0.04] shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] glass-card">
                                {status.result && (
                                    <div className="mb-8 overflow-hidden rounded-2xl border border-white/5 bg-black/40">
                                        <button onClick={() => setIsTraceOpen(!isTraceOpen)} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all"><div className="flex items-center gap-3"><Brain size={14} className="text-cyan-500" /> <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Neural Trace [{traceShards.length} Layers Found]</span></div><ChevronDown size={14} className={`text-slate-500 transition-transform ${isTraceOpen ? 'rotate-180' : ''}`} /></button>
                                        <AnimatePresence>{isTraceOpen && (
                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="p-5 border-t border-white/5 bg-[#020617] space-y-4">
                                                {traceShards.length > 0 ? traceShards.map((s, idx) => (
                                                    <div key={`trace-v2-${idx}-${s.source}`} className="border-l-2 border-cyan-500/30 pl-4 py-1">
                                                        <div className="text-[9px] font-black text-cyan-500 uppercase mb-1">{s.source}</div>
                                                        <div className="text-[10px] font-mono text-slate-400 line-clamp-2 italic">"{s.content}"</div>
                                                    </div>
                                                )) : (
                                                    <div className="text-[10px] font-mono text-cyan-400/60">[SCANNING] NO_LOCAL_MATCH_FOUND... USING_GLOBAL_HIVE</div>
                                                )}
                                            </motion.div>
                                        )}</AnimatePresence>
                                    </div>
                                )}
                                {/* Deep Think Loop Visualization */}
                                {thinkLoop && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }} 
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-8 overflow-hidden rounded-2xl think-loop-active bg-black/60"
                                    >
                                        <div className="p-5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="think-orbit-ring">
                                                        <RotateCcw size={16} className="text-purple-400" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">
                                                        Neural Debate Loop — Iteration {thinkLoop.iteration}/{thinkLoop.max_iterations}
                                                    </span>
                                                </div>
                                                <div className="think-iteration-badge px-3 py-1 rounded-full">
                                                    <span className="text-[9px] font-black text-purple-300 uppercase tracking-widest">
                                                        {thinkLoop.phase}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Iteration Progress Dots */}
                                            <div className="flex items-center gap-2">
                                                {Array.from({ length: thinkLoop.max_iterations }).map((_, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
                                                            i < thinkLoop.iteration 
                                                                ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' 
                                                                : i === thinkLoop.iteration - 1 && (thinkLoop.phase === 'REFINING' || thinkLoop.phase === 'DEBATING')
                                                                    ? 'bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]'
                                                                    : 'bg-white/10'
                                                         }`} />
                                                        {i < thinkLoop.max_iterations - 1 && (
                                                            <div className={`w-8 h-0.5 ${i < thinkLoop.iteration - 1 ? 'bg-purple-500/50' : 'bg-white/5'}`} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Critic Score */}
                                            {thinkLoop.score !== undefined && (
                                                <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5">
                                                    <Zap size={14} className={thinkLoop.score >= 7 ? 'text-emerald-400' : 'text-orange-400'} />
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Debate Outcome</span>
                                                            <span className={`text-[11px] font-black ${thinkLoop.score >= 7 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                                                {thinkLoop.score}/10
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                            <motion.div 
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${thinkLoop.score * 10}%` }}
                                                                className={`h-full rounded-full ${thinkLoop.score >= 7 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                    <span className={`text-[9px] font-black px-2 py-1 rounded-full ${
                                                        (thinkLoop.verdict === 'ACCEPT' || thinkLoop.verdict === 'PASS')
                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                            : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                    }`}>
                                                        {thinkLoop.verdict || 'EVALUATING'}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Weaknesses Found */}
                                            {thinkLoop.weaknesses && thinkLoop.weaknesses.length > 0 && (
                                                <div className="space-y-1 pl-4 border-l-2 border-orange-500/30">
                                                    {thinkLoop.weaknesses.slice(0, 3).map((w, i) => (
                                                        <div key={i} className="text-[9px] text-orange-300/70 font-mono">→ {w}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                                <div className="markdown-content">
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]} 
                                        components={{ 
                                            code({className, children}) { 
                                                const match = /language-(\w+)/.exec(className || ''); 
                                                return match ? (
                                                    <div className="relative group/code my-6">
                                                        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                                                            <button 
                                                                onClick={() => navigator.clipboard.writeText(String(children))} 
                                                                className="p-2 bg-white/10 hover:bg-cyan-500/20 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-all"
                                                            >
                                                                 <Copy size={12}/>
                                                            </button>
                                                        </div>
                                                        <SyntaxHighlighter 
                                                            style={atomDark as any} 
                                                            language={match[1]} 
                                                            PreTag="div" 
                                                            className="rounded-2xl !bg-[#050505] !p-6 border border-white/5 !m-0" 
                                                        >
                                                            {String(children).replace(/\n$/, '')}
                                                        </SyntaxHighlighter>
                                                    </div>
                                                ) : (
                                                    <code className="bg-white/10 px-1.5 py-0.5 rounded text-cyan-400 font-mono text-sm">
                                                        {children}
                                                    </code>
                                                ) 
                                            } 
                                        }}
                                    >
                                        {status.result || ""}
                                    </ReactMarkdown>
                                </div>
                                {!status.result && <div className="flex items-center gap-3 text-cyan-500 animate-pulse font-black text-[9px] tracking-[0.2em] italic uppercase"><Loader2 size={12} className="animate-spin" /> {status.message}...</div>}
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} className="h-10" />
            </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 z-[150] pointer-events-none">
            <div className="max-w-4xl mx-auto w-full pointer-events-auto">
                <AnimatePresence>
                    {attachedImage && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="mb-4 ml-8 p-1 bg-white/5 border border-cyan-500/30 rounded-xl w-32 relative group"
                        >
                            <img src={attachedImage} className="w-full h-20 object-cover rounded-lg" />
                            <button 
                                onClick={() => setAttachedImage(null)}
                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                            <div className="text-[8px] font-black text-cyan-500 mt-1 text-center uppercase tracking-widest">Vision Uplink</div>
                        </motion.div>
                    )}
                    {attachedFileName && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="mb-4 ml-8 p-3 bg-white/5 border border-purple-500/30 rounded-xl max-w-sm relative group flex items-center gap-3"
                        >
                            <FileText size={20} className="text-purple-400" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] text-white font-bold truncate">{attachedFileName}</div>
                                <div className="text-[8px] font-black text-purple-500 mt-1 uppercase tracking-widest">Document Uplink</div>
                            </div>
                            <button 
                                onClick={() => { setAttachedFileContent(null); setAttachedFileName(null); }}
                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
                          <div className="relative flex items-center bg-[#0d1117]/80 backdrop-blur-md border border-white/5 rounded-sm p-0 px-1 shadow-none transition-all group overflow-hidden">
                    <div className="flex gap-1 ml-2 md:ml-3 pr-1 md:pr-2 border-r border-white/10">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".txt,.md,.py,.js,.ts,.tsx,.json,.csv" 
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    setAttachedFileName(file.name);
                                    const reader = new FileReader();
                                    reader.onloadend = () => setAttachedFileContent(reader.result as string);
                                    reader.readAsText(file);
                                }
                            }}
                        />
                        <input 
                            type="file" 
                            ref={imageInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setAttachedImage(reader.result as string);
                                    reader.readAsDataURL(file);
                                }
                            }}
                        />
                        <button onClick={() => imageInputRef.current?.click()} className={`p-2 transition-colors ${attachedImage ? 'text-cyan-400' : 'text-slate-600 hover:text-cyan-400'}`} title="Vision Scan">
                            <Camera size={18}/>
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className={`p-2 transition-colors ${attachedFileContent ? 'text-purple-400' : 'text-slate-600 hover:text-purple-400'}`} title="Upload Document Context">
                            <FileText size={18}/>
                        </button>
                        <button onClick={() => setIsPaletteOpen(true)} className="hidden sm:block p-2 text-slate-600 hover:text-cyan-400 transition-colors" title="Command Palette (Ctrl+K)">
                            <Layers size={18}/>
                        </button>
                    </div>
                    <textarea 
                        ref={inputRef as any} 
                        value={goal} 
                        onChange={e => {
                            setGoal(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = (e.target.scrollHeight) + 'px';
                        }} 
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleLaunch();
                            }
                        }} 
                        className="flex-1 bg-transparent outline-none text-[9px] text-white/50 placeholder:text-slate-900 px-2 py-1 font-mono tracking-tighter resize-none max-h-16 custom-scrollbar" 
                        placeholder={isSidebarOpen ? "Initiate telemetry uplink..." : `System ready. Engage AuraCore ${version}...`} 
                        rows={1}
                    />
                    {status.status !== 'idle' && status.status !== 'completed' && status.status !== 'error' ? (
                        <button onClick={stopMission} className="p-2 md:p-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-xl transition-all active:scale-95 mr-2">
                            <Square className="w-3.5 h-3.5 md:w-4 md:h-4" fill="currentColor" />
                        </button>
                    ) : null}
                    <button onClick={() => { handleLaunch(); setAttachedImage(null); setAttachedFileContent(null); setAttachedFileName(null); }} disabled={!goal || !isModelReady || (status.status !== 'idle' && status.status !== 'completed' && status.status !== 'error')} className="p-2 md:p-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/5 disabled:text-slate-800 text-white rounded-xl transition-all shadow-xl shadow-cyan-600/20 active:scale-95 btn-premium">
                        {status.status === 'building' ? <Loader2 size={18} className="animate-spin" /> : status.status === 'thinking' ? <RotateCcw size={18} className="animate-spin text-purple-400" /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </div>

        <AnimatePresence>
            {isPaletteOpen && (
                <div className="fixed inset-0 z-[1000] flex items-start justify-center pt-[15vh] px-4 bg-black/40 backdrop-blur-xl">
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: -20 }} 
                        animate={{ scale: 1, opacity: 1, y: 0 }} 
                        exit={{ scale: 0.95, opacity: 0, y: -20 }} 
                        className="w-full max-w-xl bg-[#09090b]/95 border border-white/10 rounded-[24px] shadow-[0_50px_100px_rgba(0,0,0,1)] overflow-hidden"
                    >
                        <div className="p-5 border-b border-white/5 flex items-center gap-4">
                            <div className="p-2 bg-cyan-500/10 rounded-lg"><Command size={18} className="text-cyan-400" /></div>
                            <input 
                                autoFocus 
                                placeholder="Execute system command..." 
                                className="bg-transparent border-none outline-none text-lg text-white w-full font-medium placeholder:text-slate-700" 
                                onKeyDown={(e) => { if (e.key === 'Escape') setIsPaletteOpen(false); }}
                            />
                            <div className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[8px] font-black text-slate-500 uppercase">ESC</div>
                        </div>
                        <div className="p-2 max-h-[300px] overflow-y-auto">
                            <div className="px-3 py-2 text-[8px] font-black text-slate-600 uppercase tracking-widest">Recommended Actions</div>
                            {[
                                {icon: <Wifi size={14} />, label: "FORCE_NEURAL_SYNC", desc: "Sync knowledge base with live web state", color: "text-emerald-400"},
                                {icon: <Shield size={14} />, label: "ENGAGE_REDTEAM_OVERRIDE", desc: "Switch to high-security adversarial reasoning", color: "text-red-400"},
                                {icon: <LucideHistory size={14} />, label: "PURGE_MISSION_MEMORY", desc: "Clear local session history for privacy", color: "text-orange-400"},
                                {icon: <Download size={14} />, label: "EXPORT_INTELLIGENCE_REPORT", desc: "Download the full mission audit PDF", color: "text-cyan-400"}
                            ].map((cmd, idx) => (
                                <button key={idx} onClick={() => setIsPaletteOpen(false)} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all group text-left">
                                    <div className={`p-2 bg-white/5 rounded-lg group-hover:bg-white/10 ${cmd.color}`}>{cmd.icon}</div>
                                    <div className="flex-1">
                                        <div className="text-[10px] font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-widest">{cmd.label}</div>
                                        <div className="text-[9px] text-slate-500 font-medium">{cmd.desc}</div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity"><Send size={12} className="text-slate-600" /></div>
                                </button>
                            ))}
                        </div>
                        <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-white/5 text-[7px] text-slate-500 font-bold border border-white/10">↑↓</span> <span className="text-[7px] text-slate-600 font-black uppercase">Navigate</span></div>
                                <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-white/5 text-[7px] text-slate-500 font-bold border border-white/10">ENTER</span> <span className="text-[7px] text-slate-600 font-black uppercase">Execute</span></div>
                            </div>
                            <span className="text-[7px] text-cyan-500/40 font-black tracking-widest">AURA_OS v5.5</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <div className="fixed top-8 right-8 z-[2000] flex flex-col gap-3">
            <AnimatePresence>
                {notifications.map((n) => (
                    <motion.div key={n.id} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }} className="px-6 py-4 rounded-2xl bg-black/80 backdrop-blur-3xl border border-cyan-500/30 shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_#22d3ee] animate-pulse" />
                        <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase italic">{n.msg}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>

        {/* License Activation Overlay — only shows for customer/production builds */}
        <AnimatePresence>
            {!license.valid && license.status !== "DEV" && license.status !== "PENDING" && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-[5000] bg-[#020617]/95 backdrop-blur-2xl flex items-center justify-center p-6 text-center"
                >
                    <div className="max-w-md w-full space-y-6">
                        <div className="relative inline-block">
                             <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full" />
                             <Shield size={64} className="text-cyan-500 relative z-10 mx-auto" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Activate AuraCore</h2>
                            <p className="text-slate-500 font-mono text-xs tracking-widest uppercase">{license.message}</p>
                        </div>
                        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4 text-left">
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Your Name</label>
                                <input value={licOwner} onChange={e => setLicOwner(e.target.value)} className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500/50" placeholder="Customer name" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">License Key</label>
                                <input value={licKey} onChange={e => setLicKey(e.target.value)} className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-white text-sm font-mono outline-none focus:border-cyan-500/50" placeholder="AURA-XXXX-XXXX-XXXX-XXXX" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Expiry Date</label>
                                <input value={licExpiry} onChange={e => setLicExpiry(e.target.value)} className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500/50" placeholder="2026-12-31" />
                            </div>
                            {licError && <p className="text-red-400 text-xs font-bold">{licError}</p>}
                            <button 
                                onClick={async () => {
                                    setLicError("");
                                    try {
                                        const res = await fetch(`/api/activate`, {
                                            method: "POST",
                                            headers: {"Content-Type": "application/json"},
                                            body: JSON.stringify({ owner: licOwner, key: licKey, expiry: licExpiry })
                                        });
                                        const data = await res.json();
                                        if (data.valid) {
                                            setLicense(data);
                                            addNotification("LICENSE_ACTIVATED");
                                        } else {
                                            setLicError(data.message || "Invalid license key");
                                        }
                                    } catch (e) {
                                        setLicError("Connection failed. Is the backend running?");
                                    }
                                }}
                                disabled={!licOwner || !licKey || !licExpiry}
                                className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/5 disabled:text-slate-700 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all shadow-xl shadow-cyan-600/20 active:scale-95"
                            >
                                ACTIVATE_LICENSE
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

      </div>
    </div>
  );
}


