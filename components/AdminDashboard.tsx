
import React, { useState, useMemo } from 'react';
import { ArchivedSession, TranscriptItem } from '../types';
import { 
  X, Play, FileSpreadsheet, PhoneOutgoing, Mic, Download, 
  FileText, MessageSquare, Clock, Calendar, User, ChevronDown, ChevronUp,
  Search, Filter, CheckCircle2
} from 'lucide-react';

interface AdminDashboardProps {
  sessions: ArchivedSession[];
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ sessions, onClose }) => {
  const [activeView, setActiveView] = useState<'sessions' | 'leads' | 'logs'>('sessions');
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Derived Statistics
  const stats = useMemo(() => {
    return {
        totalCalls: sessions.length,
        totalLeads: sessions.reduce((acc, s) => acc + s.leads.length, 0),
        totalActions: sessions.reduce((acc, s) => acc + s.actions.length, 0),
        avgDuration: sessions.length > 0 
            ? Math.round(sessions.reduce((acc, s) => acc + (s.endTime.getTime() - s.startTime.getTime())/1000, 0) / sessions.length) 
            : 0
    };
  }, [sessions]);

  const handlePlay = (blob: Blob | null, id: string) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => setPlayingAudio(null);
    setPlayingAudio(id);
  };

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Session ID,Name,Phone,Email,Interest,Timestamp\n";

    sessions.forEach(session => {
        session.leads.forEach(lead => {
            const row = `${session.id},${lead.name},${lead.phone},${lead.email || ''},${lead.interest || ''},${lead.timestamp.toLocaleString()}\n`;
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
                        <span>{stats.totalCalls} Calls</span>
                        <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                        <span>{stats.totalLeads} Leads Captured</span>
                        <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                        <span>{stats.avgDuration}s Avg Duration</span>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition">
                <X className="w-6 h-6" />
            </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar Navigation */}
            <div className="w-64 bg-slate-800/30 border-r border-slate-700 flex flex-col p-4 gap-2">
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
                                            <div className="w-12 h-12 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20">
                                                {session.id.substring(0, 2)}
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
                                            {/* Audio Player Controls */}
                                            {session.audioBlob && (
                                                <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-slate-700/50">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handlePlay(session.audioBlob, session.id); }}
                                                        className={`p-2 rounded-md transition-all ${playingAudio === session.id ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                                        title="Play Recording"
                                                    >
                                                        <Play className="w-4 h-4 fill-current" />
                                                    </button>
                                                    <a 
                                                        href={URL.createObjectURL(session.audioBlob)} 
                                                        download={`LIA-Session-${session.id}.webm`}
                                                        className="p-2 rounded-md hover:bg-slate-700 text-slate-400 transition-colors"
                                                        title="Download Audio"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
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
                                        <th className="px-6 py-4">Session ID</th>
                                        <th className="px-6 py-4">Captured At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {sessions.flatMap(s => s.leads.map(l => ({...l, sessionId: s.id}))).length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">No leads captured yet.</td></tr>
                                    ) : (
                                        sessions.flatMap(s => s.leads.map(l => ({...l, sessionId: s.id}))).map((lead) => (
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
                                                <td className="px-6 py-4 font-mono text-xs">{lead.sessionId}</td>
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
