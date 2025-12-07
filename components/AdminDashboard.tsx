
import React, { useState, useMemo, useEffect } from 'react';
import { ArchivedSession, KnowledgeItem } from '../types';
import { syncPendingSessions, getAllSessionsFromDb, getKnowledgeItems, saveKnowledgeItem, deleteKnowledgeItem } from '../services/storage';
import { 
  X, Play, PhoneOutgoing, Mic, Download, 
  FileText, MessageSquare, Clock, Calendar, User, ChevronDown, ChevronUp,
  Search, Cloud, CloudOff, RefreshCw, BarChart3, BrainCircuit, Plus, Trash2, CheckSquare, Square,
  FileUp, BookOpen
} from 'lucide-react';

interface AdminDashboardProps {
  sessions: ArchivedSession[];
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ sessions: initialSessions, onClose }) => {
  const [sessions, setSessions] = useState<ArchivedSession[]>(initialSessions);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [activeView, setActiveView] = useState<'analytics' | 'brain' | 'sessions' | 'leads' | 'logs'>('analytics');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // New Knowledge Form State
  const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicContent, setNewTopicContent] = useState('');
  const [newTopicFile, setNewTopicFile] = useState<File | null>(null);

  useEffect(() => {
    getKnowledgeItems().then(setKnowledgeItems);
  }, []);

  // Derived Statistics for Analytics
  const stats = useMemo(() => {
    const totalCalls = sessions.length;
    const totalLeads = sessions.reduce((acc, s) => acc + s.leads.length, 0);
    
    // Calculate Leads by Interest
    const interests: Record<string, number> = {};
    sessions.forEach(s => s.leads.forEach(l => {
        const i = l.interest || 'General';
        interests[i] = (interests[i] || 0) + 1;
    }));
    
    // Calculate Activity by Day (Last 7 days)
    const dailyActivity: Record<string, number> = {};
    const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
    }).reverse();
    
    last7Days.forEach(d => dailyActivity[d] = 0);
    sessions.forEach(s => {
        const d = new Date(s.startTime).toLocaleDateString('en-GB');
        if (dailyActivity[d] !== undefined) dailyActivity[d]++;
    });

    return {
        totalCalls,
        totalLeads,
        pendingSync: sessions.filter(s => !s.synced).length,
        avgDuration: sessions.length > 0 
            ? Math.round(sessions.reduce((acc, s) => acc + (s.endTime.getTime() - s.startTime.getTime())/1000, 0) / sessions.length) 
            : 0,
        interests,
        dailyActivity: last7Days.map(d => ({ date: d, count: dailyActivity[d] }))
    };
  }, [sessions]);

  const handleSync = async () => {
    setIsSyncing(true);
    await syncPendingSessions();
    const updatedSessions = await getAllSessionsFromDb();
    setSessions(updatedSessions);
    setIsSyncing(false);
  };

  const handleSaveKnowledge = async () => {
      if(!newTopicTitle || !newTopicContent) return;
      
      const newItem: KnowledgeItem = {
          id: Math.random().toString(36).substring(7),
          title: newTopicTitle,
          content: newTopicContent,
          type: newTopicFile ? 'pdf' : 'text',
          fileName: newTopicFile?.name,
          fileBlob: newTopicFile || undefined,
          active: true,
          createdAt: new Date()
      };
      
      await saveKnowledgeItem(newItem);
      const updated = await getKnowledgeItems();
      setKnowledgeItems(updated);
      
      // Reset Form
      setIsAddingKnowledge(false);
      setNewTopicTitle('');
      setNewTopicContent('');
      setNewTopicFile(null);
  };

  const handleDeleteKnowledge = async (id: string) => {
      if(!confirm("Are you sure?")) return;
      await deleteKnowledgeItem(id);
      setKnowledgeItems(await getKnowledgeItems());
  };

  const toggleKnowledgeActive = async (item: KnowledgeItem) => {
      const updated = { ...item, active: !item.active };
      await saveKnowledgeItem(updated);
      setKnowledgeItems(await getKnowledgeItems());
  };

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Session ID,Name,Phone,Email,Interest,Timestamp,Synced\n";
    sessions.forEach(session => {
        session.leads.forEach(lead => {
            const row = `${session.id},${lead.name},${lead.phone},${lead.email || ''},${lead.interest || ''},${lead.timestamp.toLocaleString()},${session.synced ? 'Yes' : 'No'}\n`;
            csvContent += row;
        });
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "LIA_Leads_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSessions = sessions.filter(s => 
    s.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.leads.some(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full h-full max-w-7xl rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="h-16 border-b border-slate-700 flex justify-between items-center px-6 bg-slate-800/50">
            <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
                    <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">LIA Management Console</h2>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                         {isSyncing ? (
                             <span className="text-indigo-400 animate-pulse flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin"/> Syncing...</span>
                         ) : (
                             <span className={stats.pendingSync > 0 ? "text-amber-400 font-bold" : ""}>{stats.pendingSync} Unsynced</span>
                         )}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button 
                    onClick={handleSync}
                    disabled={isSyncing || stats.pendingSync === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-xs font-medium text-slate-300 disabled:opacity-50 transition-all"
                >
                    <Cloud className="w-3.5 h-3.5" />
                    Sync Now
                </button>
                <div className="h-6 w-px bg-slate-700"></div>
                <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition">
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar Navigation */}
            <div className="w-64 bg-slate-800/30 border-r border-slate-700 flex flex-col p-4 gap-2">
                <button 
                    onClick={() => setActiveView('analytics')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeView === 'analytics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Analytics
                </button>
                <button 
                    onClick={() => setActiveView('brain')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeView === 'brain' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <BrainCircuit className="w-4 h-4" />
                    The Brain
                </button>
                <div className="h-px bg-slate-700 my-2"></div>
                <button 
                    onClick={() => setActiveView('sessions')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeView === 'sessions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <Mic className="w-4 h-4" />
                    Call History
                </button>
                <button 
                    onClick={() => setActiveView('leads')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeView === 'leads' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <User className="w-4 h-4" />
                    Lead CRM
                </button>
                <button 
                    onClick={() => setActiveView('logs')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeView === 'logs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <PhoneOutgoing className="w-4 h-4" />
                    System Logs
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-slate-900 overflow-y-auto p-6 relative">
                
                {/* --- ANALYTICS VIEW --- */}
                {activeView === 'analytics' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                                <h4 className="text-slate-400 text-xs font-bold uppercase">Total Leads</h4>
                                <div className="text-3xl font-bold text-white mt-2">{stats.totalLeads}</div>
                                <div className="text-emerald-400 text-xs mt-1">+12% vs last week</div>
                            </div>
                            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                                <h4 className="text-slate-400 text-xs font-bold uppercase">Calls Made</h4>
                                <div className="text-3xl font-bold text-white mt-2">{stats.totalCalls}</div>
                            </div>
                            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                                <h4 className="text-slate-400 text-xs font-bold uppercase">Avg Duration</h4>
                                <div className="text-3xl font-bold text-white mt-2">{stats.avgDuration}s</div>
                            </div>
                            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                                <h4 className="text-slate-400 text-xs font-bold uppercase">Pending Upload</h4>
                                <div className="text-3xl font-bold text-amber-400 mt-2">{stats.pendingSync}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Interest Distribution (Pie Chart Simulation) */}
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 min-h-[300px]">
                                <h4 className="text-white font-semibold mb-6 flex items-center gap-2">
                                    <User className="w-4 h-4 text-indigo-400" /> Lead Interests
                                </h4>
                                <div className="space-y-4">
                                    {Object.keys(stats.interests).length === 0 ? (
                                        <div className="text-slate-500 text-center py-10">No data available</div>
                                    ) : (
                                        Object.entries(stats.interests).map(([interest, count], idx) => {
                                            const percentage = Math.round((count / stats.totalLeads) * 100);
                                            return (
                                                <div key={interest} className="group">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-slate-300">{interest}</span>
                                                        <span className="text-slate-400">{percentage}% ({count})</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full bg-indigo-${500 + idx * 100} transition-all duration-1000`} 
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Daily Activity (Bar Chart Simulation) */}
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 min-h-[300px]">
                                <h4 className="text-white font-semibold mb-6 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-emerald-400" /> Daily Activity
                                </h4>
                                <div className="h-48 flex items-end justify-between gap-2">
                                    {stats.dailyActivity.map((day, idx) => {
                                        const max = Math.max(...stats.dailyActivity.map(d => d.count), 5); // Avoid div by zero
                                        const height = (day.count / max) * 100;
                                        const dateParts = day.date.split('/');
                                        
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                                                <div 
                                                    className="w-full bg-emerald-500/20 group-hover:bg-emerald-500/40 rounded-t-sm transition-all relative"
                                                    style={{ height: `${Math.max(height, 5)}%` }}
                                                >
                                                    {day.count > 0 && (
                                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-900 px-1.5 rounded opacity-0 group-hover:opacity-100 transition">
                                                            {day.count}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-500 rotate-0 md:rotate-0 truncate w-full text-center">
                                                    {dateParts[0]}/{dateParts[1]}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- BRAIN VIEW --- */}
                {activeView === 'brain' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-semibold text-white">Knowledge Base (The Brain)</h3>
                                <p className="text-slate-400 text-sm">Teach the AI new courses, pricing, or facts. Active items are injected into the model.</p>
                            </div>
                            <button 
                                onClick={() => setIsAddingKnowledge(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-600/20"
                            >
                                <Plus className="w-4 h-4" /> Add Topic
                            </button>
                        </div>

                        {/* Add Knowledge Form */}
                        {isAddingKnowledge && (
                            <div className="bg-slate-800 p-6 rounded-xl border border-indigo-500/30 mb-8 animate-in slide-in-from-top-4">
                                <h4 className="font-semibold text-white mb-4">Add New Knowledge Topic</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Topic Title</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                                            placeholder="e.g. Advanced AI Diploma Pricing"
                                            value={newTopicTitle}
                                            onChange={e => setNewTopicTitle(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Content (Text context for AI)</label>
                                        <textarea 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none h-32"
                                            placeholder="Paste the course details, prices, or FAQs here..."
                                            value={newTopicContent}
                                            onChange={e => setNewTopicContent(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Upload PDF (Optional - For Reference)</label>
                                        <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-indigo-500/50 transition cursor-pointer relative">
                                            <input 
                                                type="file" 
                                                accept=".pdf" 
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={e => setNewTopicFile(e.target.files?.[0] || null)}
                                            />
                                            <FileUp className="w-6 h-6 mx-auto text-slate-500 mb-2" />
                                            <p className="text-sm text-slate-400">{newTopicFile ? newTopicFile.name : "Click to upload PDF"}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 justify-end pt-2">
                                        <button onClick={() => setIsAddingKnowledge(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                                        <button onClick={handleSaveKnowledge} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Save Topic</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Knowledge List */}
                        <div className="grid grid-cols-1 gap-4">
                            {knowledgeItems.length === 0 ? (
                                <div className="text-center py-20 text-slate-500 bg-slate-800/20 rounded-2xl border border-slate-800 border-dashed">
                                    <BrainCircuit className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p>Brain is empty. Add a topic to teach the AI.</p>
                                </div>
                            ) : (
                                knowledgeItems.map(item => (
                                    <div key={item.id} className={`bg-slate-800/50 border rounded-xl p-4 flex justify-between items-start transition-all ${item.active ? 'border-indigo-500/30' : 'border-slate-700 opacity-60'}`}>
                                        <div className="flex gap-4">
                                            <div className={`p-3 rounded-lg ${item.type === 'pdf' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                {item.type === 'pdf' ? <BookOpen className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-200">{item.title}</h4>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-xl">{item.content}</p>
                                                {item.fileName && (
                                                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300">
                                                        PDF: {item.fileName}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => toggleKnowledgeActive(item)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition ${item.active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                            >
                                                {item.active ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                                                {item.active ? 'Active' : 'Inactive'}
                                            </button>
                                            <button onClick={() => handleDeleteKnowledge(item.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* --- SESSIONS VIEW --- */}
                {activeView === 'sessions' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-white">Call Recordings & Transcripts</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    type="text" 
                                    placeholder="Search IDs or Names..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-64"
                                />
                            </div>
                        </div>

                        {filteredSessions.length === 0 ? (
                            <div className="text-center py-20 text-slate-500 bg-slate-800/20 rounded-2xl border border-slate-800 border-dashed">
                                <Mic className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>No sessions found.</p>
                            </div>
                        ) : (
                            filteredSessions.map((session) => (
                                <div key={session.id} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition-all">
                                    {/* Session Header Card */}
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20 relative">
                                                {session.id.substring(0, 2)}
                                                <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-slate-700">
                                                    {session.synced ? (
                                                        <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                                                    ) : (
                                                        <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-slate-200">Session #{session.id}</h4>
                                                    {session.leads.length > 0 && (
                                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 uppercase tracking-wide">
                                                            Lead Captured
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {session.startTime.toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {session.startTime.toLocaleTimeString()}</span>
                                                    <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> {Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000)}s</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Native Audio Player for Better Compatibility */}
                                            {session.audioBlob && (
                                                <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                                                    <audio 
                                                        controls 
                                                        src={URL.createObjectURL(session.audioBlob)} 
                                                        className="h-8 w-48 md:w-64" 
                                                        title="Recorded Audio"
                                                    />
                                                </div>
                                            )}

                                            <div className="h-8 w-px bg-slate-700 mx-2"></div>

                                            <button 
                                                onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${expandedSession === session.id ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-slate-700 text-slate-300'}`}
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                {expandedSession === session.id ? 'Hide Transcript' : 'Show Transcript'}
                                                {expandedSession === session.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Transcript View */}
                                    {expandedSession === session.id && (
                                        <div className="border-t border-slate-700 bg-slate-950/30 p-4">
                                            <div className="max-h-60 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                                {session.transcripts.length === 0 ? (
                                                    <p className="text-slate-500 text-sm italic text-center">No transcript available for this session.</p>
                                                ) : (
                                                    session.transcripts.map((t) => (
                                                        <div key={t.id} className={`flex gap-3 ${t.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${t.sender === 'user' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                                                {t.sender === 'user' ? 'You' : 'AI'}
                                                            </div>
                                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${t.sender === 'user' ? 'bg-emerald-500/10 text-emerald-100 rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
                                                                {t.text}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* --- LEADS VIEW --- */}
                {activeView === 'leads' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-semibold text-white">Lead Database (CRM)</h3>
                            <button 
                                onClick={exportToCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-emerald-600/20"
                            >
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                        </div>
                        
                        <div className="bg-slate-800/40 rounded-xl border border-slate-700 overflow-hidden">
                            <table className="w-full text-sm text-left text-slate-400">
                                <thead className="text-xs text-slate-300 uppercase bg-slate-800 border-b border-slate-700">
                                    <tr>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Phone Number</th>
                                        <th className="px-6 py-4">Interest</th>
                                        <th className="px-6 py-4">Sync Status</th>
                                        <th className="px-6 py-4">Captured At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {sessions.flatMap(s => s.leads.map(l => ({...l, sessionId: s.id, synced: s.synced}))).length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">No leads captured yet.</td></tr>
                                    ) : (
                                        sessions.flatMap(s => s.leads.map(l => ({...l, sessionId: s.id, synced: s.synced}))).map((lead) => (
                                            <tr key={lead.id} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                                                        {lead.name.charAt(0)}
                                                    </div>
                                                    {lead.name}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-slate-300">{lead.phone}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-md bg-slate-700 text-xs text-slate-300 border border-slate-600">
                                                        {lead.interest || 'General Inquiry'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {lead.synced ? (
                                                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium"><Cloud className="w-3 h-3" /> Synced</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-amber-500 text-xs font-medium"><CloudOff className="w-3 h-3" /> Pending</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">{new Date(lead.timestamp).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- LOGS VIEW --- */}
                {activeView === 'logs' && (
                     <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-white">System Logs & Actions</h3>
                        </div>
                        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-400 space-y-2 h-[600px] overflow-y-auto">
                            {sessions.length === 0 ? (
                                <div className="text-center py-10 opacity-50">No system logs available.</div>
                            ) : (
                                sessions.flatMap(s => s.actions.map(a => ({...a, sessionId: s.id}))).reverse().map((action, i) => (
                                    <div key={i} className="flex gap-4 border-b border-slate-900 pb-2 mb-2 last:border-0">
                                        <span className="text-slate-500 shrink-0">{new Date(action.timestamp).toLocaleTimeString()}</span>
                                        <span className={`font-bold ${action.type === 'CALL' ? 'text-blue-400' : 'text-purple-400'}`}>[{action.type}]</span>
                                        <span className="text-slate-300">{action.details}</span>
                                        <span className="ml-auto text-slate-600">ID: {action.sessionId}</span>
                                    </div>
                                ))
                            )}
                             {/* Also show leads creation logs */}
                             {sessions.flatMap(s => s.leads.map(l => ({...l, sessionId: s.id}))).reverse().map((lead, i) => (
                                    <div key={`lead-${i}`} className="flex gap-4 border-b border-slate-900 pb-2 mb-2 last:border-0">
                                        <span className="text-slate-500 shrink-0">{new Date(lead.timestamp).toLocaleTimeString()}</span>
                                        <span className="font-bold text-emerald-400">[LEAD_CAPTURED]</span>
                                        <span className="text-slate-300">Saved details for {lead.name} ({lead.phone})</span>
                                        <span className="ml-auto text-slate-600">ID: {lead.sessionId}</span>
                                    </div>
                             ))}
                        </div>
                     </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
