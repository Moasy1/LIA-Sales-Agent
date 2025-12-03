
import React, { useEffect, useRef, useState } from 'react';
import { useLiveAPI } from './hooks/useLiveAPI';
import { LiveStatus, ArchivedSession } from './types';
import { saveSessionToDb, getAllSessionsFromDb } from './services/storage';
import AudioVisualizer from './components/AudioVisualizer';
import AdminDashboard from './components/AdminDashboard';
import { Phone, X, Loader2, Code, Globe, AlertCircle, Lock, Check, Copy } from 'lucide-react';

const App: React.FC = () => {
  const { 
    connect, 
    disconnect, 
    status, 
    transcripts,
    agentActions,
    leads,
    isUserSpeaking, 
    isModelSpeaking,
    inputAnalyser,
    outputAnalyser,
    userAudioBlob
  } = useLiveAPI();

  const [hasError, setHasError] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [copiedType, setCopiedType] = useState<'widget' | 'embed' | null>(null);

  // Loaded from IndexedDB
  const [archivedSessions, setArchivedSessions] = useState<ArchivedSession[]>([]);

  const currentSessionStartTime = useRef<Date | null>(null);
  const hasSavedCurrentSession = useRef<boolean>(false);

  // Load History on Mount
  useEffect(() => {
    getAllSessionsFromDb().then(sessions => {
        setArchivedSessions(sessions);
    });
  }, []);

  // Track error status
  useEffect(() => {
    if (status === LiveStatus.ERROR) {
      setHasError(true);
    } else {
      setHasError(false);
    }

    // Session Start Tracker
    if (status === LiveStatus.CONNECTED && !currentSessionStartTime.current) {
        currentSessionStartTime.current = new Date();
        hasSavedCurrentSession.current = false;
    }
  }, [status]);

  // Archive Session Logic (Save to DB)
  useEffect(() => {
    if (status === LiveStatus.DISCONNECTED && currentSessionStartTime.current && !hasSavedCurrentSession.current) {
        // Only save if we have some data interaction
        if (transcripts.length > 0 || userAudioBlob) {
            const newArchive: ArchivedSession = {
                id: Math.random().toString(36).substring(7).toUpperCase(),
                startTime: currentSessionStartTime.current,
                endTime: new Date(),
                audioBlob: userAudioBlob, 
                transcripts: [...transcripts],
                actions: [...agentActions],
                leads: [...leads]
            };
            
            // 1. Save to Database (Persist Audio)
            saveSessionToDb(newArchive).then(() => {
                // 2. Reload local state to show in dashboard
                getAllSessionsFromDb().then(setArchivedSessions);
            });
            
            hasSavedCurrentSession.current = true;
        }
        currentSessionStartTime.current = null;
    }
  }, [status, userAudioBlob, transcripts, agentActions, leads]);

  const isActive = status === LiveStatus.CONNECTED;

  const openWebsite = () => window.open('https://london-innovation-academy.com/', '_blank');
  
  const handleCopy = (type: 'widget' | 'embed', code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const widgetCode = `<!-- London Innovation Academy Floating Widget -->
<iframe
  src="${window.location.origin}"
  allow="microphone"
  title="London Innovation Academy AI"
  style="position: fixed; bottom: 20px; right: 20px; width: 380px; height: 600px; max-height: 80vh; border: none; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.4); z-index: 99999; transition: all 0.3s ease;"
></iframe>`;

  const embedCode = `<!-- London Innovation Academy Embedded Section -->
<div style="width: 100%; height: 600px; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; position: relative;">
  <iframe
    src="${window.location.origin}"
    allow="microphone"
    title="London Innovation Academy AI"
    style="width: 100%; height: 100%; border: none;"
  ></iframe>
</div>`;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col font-sans overflow-hidden">
      
      {/* Admin Panel Overlay */}
      {showAdminPanel && (
        <AdminDashboard 
            sessions={archivedSessions} 
            onClose={() => setShowAdminPanel(false)} 
        />
      )}

      {/* Header */}
      <header className="p-4 md:p-6 flex justify-between items-center border-b border-white/10 backdrop-blur-md bg-white/5 fixed w-full z-10 top-0 shadow-sm">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center text-xl font-bold shadow-lg shadow-indigo-500/30">
                LIA
            </div>
            <div>
                <h1 className="text-base md:text-lg font-bold tracking-wide leading-tight">London Innovation Academy</h1>
                <p className="text-[10px] md:text-xs text-indigo-300 uppercase tracking-widest font-medium">AI Sales System</p>
            </div>
        </div>

        {/* Business Buttons */}
        <div className="flex items-center gap-2 md:gap-3">
           <button 
             onClick={() => setShowEmbedModal(true)}
             className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-full text-xs font-medium transition-colors"
             title="Get Embed Code"
           >
             <Code className="w-4 h-4 text-indigo-400" />
           </button>

           <button 
             onClick={openWebsite}
             className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-medium transition-colors"
           >
             <Globe className="w-4 h-4 text-indigo-400" />
             <span>الموقع الرسمي</span>
           </button>
           
           {/* Admin Toggle Button */}
           <button 
             onClick={() => setShowAdminPanel(true)}
             className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-slate-400 hover:text-white transition-colors relative"
             title="Admin Console"
           >
             <Lock className="w-4 h-4" />
             {archivedSessions.length > 0 && (
                 <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900"></span>
             )}
           </button>

           <div className="h-6 w-px bg-white/10 mx-1 hidden md:block"></div>

           <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : status === LiveStatus.ERROR ? 'bg-red-500' : 'bg-slate-500'}`} />
              <span className="text-xs font-mono text-slate-400 uppercase hidden md:inline">
                  {status === LiveStatus.CONNECTING ? 'Connecting...' : status === LiveStatus.CONNECTED ? 'System Active' : status === LiveStatus.ERROR ? 'Error' : 'Offline'}
              </span>
           </div>
        </div>
      </header>

      {/* Embed Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden" dir="ltr">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-400" />
                Embed Code
              </h3>
              <button onClick={() => setShowEmbedModal(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Option 1 */}
              <div>
                <h4 className="text-sm font-medium text-indigo-300 mb-2 uppercase tracking-wider">Option 1: Floating Widget (Bottom Right)</h4>
                <div className="relative group">
                  <pre className="bg-black/50 p-4 rounded-lg text-xs text-slate-300 font-mono overflow-x-auto border border-white/5">
                    {widgetCode}
                  </pre>
                  <button 
                    onClick={() => handleCopy('widget', widgetCode)}
                    className="absolute top-2 right-2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white transition-colors"
                  >
                    {copiedType === 'widget' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              {/* Option 2 */}
              <div>
                <h4 className="text-sm font-medium text-indigo-300 mb-2 uppercase tracking-wider">Option 2: Embedded Section</h4>
                <div className="relative group">
                   <pre className="bg-black/50 p-4 rounded-lg text-xs text-slate-300 font-mono overflow-x-auto border border-white/5">
                    {embedCode}
                  </pre>
                  <button 
                    onClick={() => handleCopy('embed', embedCode)}
                    className="absolute top-2 right-2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white transition-colors"
                  >
                    {copiedType === 'embed' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification for Leads */}
      {leads.length > 0 && isActive && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 px-6 py-3 rounded-full flex items-center gap-3 animate-in fade-in slide-in-from-top-4 z-40 backdrop-blur-md shadow-xl">
            <Check className="w-5 h-5 text-emerald-400" />
            <span className="font-medium">Lead captured successfully!</span>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center pt-20 h-screen relative overflow-hidden">
        
        {/* Error Banner */}
        {hasError && (
          <div className="absolute top-24 w-full max-w-md bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 z-50">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div className="text-sm">
              <p className="font-semibold">فشل الاتصال بالنظام</p>
              <p className="text-xs opacity-80">يرجى التأكد من إعداد مفتاح API بشكل صحيح.</p>
            </div>
            <button onClick={() => setHasError(false)} className="mr-auto hover:bg-red-500/20 p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[700px] h-[300px] md:h-[700px] bg-indigo-500/10 rounded-full blur-[60px] md:blur-[120px] pointer-events-none" />

        {/* Central Orb */}
        <div className="relative w-72 h-72 md:w-96 md:h-96 flex items-center justify-center z-10">
            <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ${isActive ? 'bg-indigo-600/30' : 'bg-transparent'}`} />
            <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-300 ${isModelSpeaking ? 'bg-indigo-400/20 scale-110' : 'scale-100'}`} />
            
            <div className={`w-full h-full rounded-full border border-white/10 backdrop-blur-xl bg-white/5 flex flex-col items-center justify-center overflow-hidden relative shadow-2xl transition-all duration-500 ${isActive ? 'shadow-indigo-500/30 border-indigo-500/40' : ''}`}>
                <div className="absolute inset-0 flex flex-col opacity-60 pointer-events-none">
                    <div className="flex-1">
                        <AudioVisualizer analyser={outputAnalyser} isActive={isActive && isModelSpeaking} color="#818cf8" />
                    </div>
                    <div className="flex-1 rotate-180">
                        <AudioVisualizer analyser={inputAnalyser} isActive={isActive && isUserSpeaking} color="#34d399" />
                    </div>
                </div>

                <div className="z-10 text-center space-y-4 px-8">
                    {status === LiveStatus.CONNECTING ? (
                        <Loader2 className="w-16 h-16 text-indigo-400 animate-spin mx-auto" />
                    ) : status === LiveStatus.CONNECTED ? (
                        <div className="flex flex-col items-center gap-2">
                            {isModelSpeaking ? (
                                <span className="text-indigo-300 text-xl font-medium animate-pulse">أليكس يتحدث...</span>
                            ) : isUserSpeaking ? (
                                <span className="text-emerald-300 text-xl font-medium animate-pulse">جاري الاستماع...</span>
                            ) : (
                                <span className="text-slate-400 text-base">أنا سامعك، اتفضل</span>
                            )}
                        </div>
                    ) : (
                        <div className="text-slate-500 flex flex-col items-center animate-pulse">
                            <span className="text-sm uppercase tracking-widest mb-3 font-semibold">مساعد القبول الذكي</span>
                            <Phone className="w-10 h-10 opacity-50" />
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Main Controls */}
        <div className="mt-12 z-20">
            {!isActive ? (
                <button 
                    onClick={connect}
                    disabled={status === LiveStatus.CONNECTING}
                    className="group relative flex items-center gap-3 px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-xl transition-all shadow-xl hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 ring-4 ring-indigo-500/20"
                >
                    <Phone className="w-6 h-6 group-hover:animate-bounce" />
                    <span>تحدث مع أليكس</span>
                </button>
            ) : (
                <button 
                    onClick={disconnect}
                    className="flex items-center gap-3 px-10 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-semibold text-lg transition-all hover:shadow-lg hover:shadow-red-900/20 backdrop-blur-sm"
                >
                    <X className="w-6 h-6" />
                    <span>إنهاء المكالمة</span>
                </button>
            )}
        </div>

      </main>
    </div>
  );
};

export default App;
