
import React, { useState } from 'react';
import { ArchivedSession } from '../types';
import { X, Play, FileSpreadsheet, PhoneOutgoing, Mic, Download, FileText } from 'lucide-react';

interface AdminDashboardProps {
  sessions: ArchivedSession[];
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ sessions, onClose }) => {
  const [activeTab, setActiveTab] = useState<'recordings' | 'requests' | 'sheets'>('recordings');
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

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
    link.setAttribute("download", "LIA_Leads_Sheet.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-lg">
                    <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">LIA Admin Console</h2>
                    <p className="text-xs text-slate-400">Session Management System</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-800/30">
            <button 
                onClick={() => setActiveTab('recordings')}
                className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'recordings' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800/50' : 'text-slate-400 hover:text-white'}`}
            >
                <Mic className="w-4 h-4" />
                Recorded Calls
            </button>
            <button 
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'requests' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800/50' : 'text-slate-400 hover:text-white'}`}
            >
                <PhoneOutgoing className="w-4 h-4" />
                Requests & Actions
            </button>
            <button 
                onClick={() => setActiveTab('sheets')}
                className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'sheets' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800/50' : 'text-slate-400 hover:text-white'}`}
            >
                <FileSpreadsheet className="w-4 h-4" />
                Lead Forms (Sheet)
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
            
            {/* RECORDINGS VIEW */}
            {activeTab === 'recordings' && (
                <div className="space-y-4">
                    {sessions.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">No recorded sessions yet.</div>
                    ) : (
                        sessions.map((session, idx) => (
                            <div key={session.id} className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 flex items-center justify-between hover:bg-slate-800/60 transition">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                                        #{idx + 1}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-200">Session {session.id}</h4>
                                        <p className="text-xs text-slate-400">{session.startTime.toLocaleString()} • {Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000)}s duration</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {session.audioBlob && (
                                        <button 
                                            onClick={() => handlePlay(session.audioBlob, session.id)}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition"
                                        >
                                            {playingAudio === session.id ? 'Playing...' : <><Play className="w-4 h-4" /> Play Audio</>}
                                        </button>
                                    )}
                                    <a 
                                      href={session.audioBlob ? URL.createObjectURL(session.audioBlob) : '#'} 
                                      download={`LIA-Session-${session.id}.webm`}
                                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300"
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* REQUESTS VIEW */}
            {activeTab === 'requests' && (
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="w-full text-sm text-left text-slate-400">
                        <thead className="text-xs text-slate-300 uppercase bg-slate-800">
                            <tr>
                                <th className="px-6 py-3">Session</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Details</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.flatMap(s => s.actions.map(a => ({...a, sessionId: s.id}))).length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center">No requests recorded.</td></tr>
                            ) : (
                                sessions.flatMap(s => s.actions.map(a => ({...a, sessionId: s.id}))).map((action) => (
                                    <tr key={action.id} className="bg-slate-900 border-b border-slate-800 hover:bg-slate-800/30">
                                        <td className="px-6 py-4 font-mono text-xs">{action.sessionId}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
                                                {action.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-white">{action.details}</td>
                                        <td className="px-6 py-4">
                                            <span className="flex items-center gap-1 text-emerald-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                Completed
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{action.timestamp.toLocaleTimeString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* LEAD SHEETS VIEW */}
            {activeTab === 'sheets' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button 
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition"
                        >
                            <Download className="w-4 h-4" />
                            Export to CSV
                        </button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-700">
                        <table className="w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-300 uppercase bg-slate-800">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Phone</th>
                                    <th className="px-6 py-3">Email</th>
                                    <th className="px-6 py-3">Interest</th>
                                    <th className="px-6 py-3">Captured At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.flatMap(s => s.leads).length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center">No leads captured yet. Ask Alex to take details!</td></tr>
                                ) : (
                                    sessions.flatMap(s => s.leads).map((lead) => (
                                        <tr key={lead.id} className="bg-slate-900 border-b border-slate-800 hover:bg-slate-800/30">
                                            <td className="px-6 py-4 font-bold text-white">{lead.name}</td>
                                            <td className="px-6 py-4 font-mono">{lead.phone}</td>
                                            <td className="px-6 py-4">{lead.email || '-'}</td>
                                            <td className="px-6 py-4 text-indigo-300">{lead.interest || 'General'}</td>
                                            <td className="px-6 py-4">{lead.timestamp.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
