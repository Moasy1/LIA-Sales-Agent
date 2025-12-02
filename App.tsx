import React, { useEffect, useRef, useState } from 'react';
import { useLiveAPI } from './hooks/useLiveAPI';
import { LiveStatus } from './types';
import AudioVisualizer from './components/AudioVisualizer';
import { Mic, MicOff, Phone, X, MessageSquare, Loader2, ExternalLink, Globe, PhoneOutgoing, MessageCircle, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const { 
    connect, 
    disconnect, 
    status, 
    transcripts,
    agentActions, 
    isUserSpeaking, 
    isModelSpeaking,
    inputAnalyser,
    outputAnalyser
  } = useLiveAPI();

  const [hasError, setHasError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcripts
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts]);

  // Track error status
  useEffect(() => {
    if (status === LiveStatus.ERROR) {
      setHasError(true);
    } else {
      setHasError(false);
    }
  }, [status]);

  const isActive = status === LiveStatus.CONNECTED;

  const openWebsite = () => window.open('https://london-innovation-academy.com/', '_blank');
  const openWhatsApp = () => window.open('https://wa.me/201000000000', '_blank'); // Replace with actual number

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="p-4 md:p-6 flex justify-between items-center border-b border-white/10 backdrop-blur-md bg-white/5 fixed w-full z-10 top-0 shadow-sm">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center text-xl font-bold shadow-lg shadow-indigo-500/30">
                LIA
            </div>
            <div className="hidden md:block">
                <h1 className="text-lg font-semibold tracking-wide">أكاديمية لندن للابتكار</h1>
                <p className="text-xs text-indigo-300 uppercase tracking-widest font-medium">نظام المبيعات الذكي</p>
            </div>
        </div>

        {/* Business Buttons */}
        <div className="flex items-center gap-3">
           <button 
             onClick={openWebsite}
             className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-medium transition-colors"
           >
             <Globe className="w-4 h-4 text-indigo-400" />
             <span>الموقع الرسمي</span>
           </button>
           <button 
             onClick={openWhatsApp}
             className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded-full text-xs font-medium transition-colors"
           >
             <MessageCircle className="w-4 h-4" />
             <span className="hidden md:inline">تواصل واتساب</span>
           </button>
           
           <div className="h-6 w-px bg-white/10 mx-1 hidden md:block"></div>

           <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : status === LiveStatus.ERROR ? 'bg-red-500' : 'bg-slate-500'}`} />
              <span className="text-xs font-mono text-slate-400 uppercase hidden md:inline">
                  {status === LiveStatus.CONNECTING ? 'جاري الاتصال...' : status === LiveStatus.CONNECTED ? 'CRM متصل' : status === LiveStatus.ERROR ? 'خطأ' : 'غير متصل'}
              </span>
           </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row pt-20 h-screen">
        
        {/* Right Panel (Visualizer, Controls, Action Log) */}
        <div className="flex-1 flex flex-col items-center p-4 md:p-8 relative overflow-hidden order-2 md:order-1">
            
            {/* Error Banner */}
            {hasError && (
              <div className="absolute top-4 w-full max-w-md bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 z-50">
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

            {/* Visualizer & Orb Section */}
            <div className="flex-1 flex flex-col items-center justify-center w-full relative">
                {/* Background elements */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-indigo-500/10 rounded-full blur-[60px] md:blur-[100px] pointer-events-none" />

                <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-8 z-10">
                    <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ${isActive ? 'bg-indigo-600/30' : 'bg-transparent'}`} />
                    <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-300 ${isModelSpeaking ? 'bg-indigo-400/20 scale-110' : 'scale-100'}`} />
                    
                    <div className={`w-full h-full rounded-full border border-white/10 backdrop-blur-xl bg-white/5 flex flex-col items-center justify-center overflow-hidden relative shadow-2xl transition-all duration-500 ${isActive ? 'shadow-indigo-500/20 border-indigo-500/30' : ''}`}>
                        <div className="absolute inset-0 flex flex-col opacity-60 pointer-events-none">
                            <div className="flex-1">
                                <AudioVisualizer analyser={outputAnalyser} isActive={isActive && isModelSpeaking} color="#818cf8" />
                            </div>
                            <div className="flex-1 rotate-180">
                                <AudioVisualizer analyser={inputAnalyser} isActive={isActive && isUserSpeaking} color="#34d399" />
                            </div>
                        </div>

                        <div className="z-10 text-center space-y-2 px-4">
                            {status === LiveStatus.CONNECTING ? (
                                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
                            ) : status === LiveStatus.CONNECTED ? (
                                <div className="flex flex-col items-center gap-1">
                                    {isModelSpeaking ? (
                                        <span className="text-indigo-300 text-lg font-medium animate-pulse">أليكس يتحدث...</span>
                                    ) : isUserSpeaking ? (
                                        <span className="text-emerald-300 text-lg font-medium animate-pulse">جاري الاستماع...</span>
                                    ) : (
                                        <span className="text-slate-400 text-sm">أنا سامعك، اتفضل</span>
                                    )}
                                </div>
                            ) : (
                                <div className="text-slate-500 flex flex-col items-center">
                                    <span className="text-sm uppercase tracking-widest mb-2 font-semibold">CRM Voice Agent</span>
                                    <Phone className="w-8 h-8 opacity-50" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Buttons */}
                <div className="flex gap-4 items-center z-20 mb-8">
                    {!isActive ? (
                        <button 
                            onClick={connect}
                            disabled={status === LiveStatus.CONNECTING}
                            className="group relative flex items-center gap-3 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg transition-all shadow-xl hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                        >
                            <Phone className="w-5 h-5 group-hover:animate-bounce" />
                            <span>ابدأ النظام</span>
                        </button>
                    ) : (
                        <button 
                            onClick={disconnect}
                            className="flex items-center gap-3 px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-semibold transition-all hover:shadow-lg hover:shadow-red-900/20 backdrop-blur-sm"
                        >
                            <X className="w-5 h-5" />
                            <span>إنهاء</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Action Log / CRM Capabilities */}
            <div className="w-full max-w-2xl z-20 mt-auto bg-black/40 backdrop-blur-md rounded-t-2xl border-x border-t border-white/10 p-4 transition-all h-48 overflow-y-auto">
                <div className="flex items-center gap-2 mb-3 text-xs text-slate-400 uppercase font-semibold tracking-wider sticky top-0 bg-transparent">
                    نشاط الوكيل (Agent Actions)
                </div>
                <div className="space-y-2">
                    {agentActions.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4 border border-dashed border-white/10 rounded-lg">
                            جرب تقول: "ابعثلي التفاصيل واتساب" أو "ممكن تكلمني؟"
                        </div>
                    ) : (
                        agentActions.map((action) => (
                            <div key={action.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 animate-in slide-in-from-bottom-2 fade-in">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${action.type === 'CALL' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                        {action.type === 'CALL' ? <PhoneOutgoing className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-200">{action.type === 'CALL' ? 'اتصال صادر' : 'رسالة واتساب'}</p>
                                        <p className="text-xs text-slate-400">{action.details}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20">
                                    تم التنفيذ
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* Left Panel (Transcript) */}
        <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-r border-white/10 bg-black/20 flex flex-col h-1/2 md:h-full transition-all order-1 md:order-2">
            <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-sm font-semibold text-slate-200">سجل المحادثة</h2>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide relative">
                {transcripts.map((item) => (
                    <div 
                        key={item.id} 
                        className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                        <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                            item.sender === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-slate-700 text-slate-100 rounded-bl-none border border-slate-600'
                        }`}>
                            {item.text}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1.5 px-1 font-medium">
                            {item.sender === 'user' ? 'أنت' : 'أليكس'}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;