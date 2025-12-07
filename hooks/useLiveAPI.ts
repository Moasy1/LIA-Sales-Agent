
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, FunctionDeclaration, Type, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import { LiveStatus, TranscriptItem, AgentAction, LeadForm } from '../types';
import { getKnowledgeItems } from '../services/storage';

// Define the Tools
const tools: FunctionDeclaration[] = [
  {
    name: 'start_outbound_call',
    description: 'Initiate a phone call to a student or lead to discuss course details or follow up.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        phoneNumber: {
          type: Type.STRING,
          description: 'The phone number to call (e.g., +201xxxxxxxxx).',
        },
        reason: {
          type: Type.STRING,
          description: 'The reason for the call (e.g., Follow up on payment, Answer questions).',
        },
      },
      required: ['phoneNumber', 'reason'],
    },
  },
  {
    name: 'submit_lead_form',
    description: 'Save student information into the academy CRM/Spreadsheet when they express interest or provide details.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Student Name' },
        phone: { type: Type.STRING, description: 'Student Phone Number' },
        email: { type: Type.STRING, description: 'Student Email Address (optional)' },
        interest: { type: Type.STRING, description: 'Diploma or Course of interest (optional)' },
      },
      required: ['name', 'phone'],
    },
  },
];

export const useLiveAPI = () => {
  const [status, setStatus] = useState<LiveStatus>(LiveStatus.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const [leads, setLeads] = useState<LeadForm[]>([]);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [userAudioBlob, setUserAudioBlob] = useState<Blob | null>(null);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioStreamDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  
  // Recorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  const disconnect = useCallback(() => {
    // Stop Recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    scheduledSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    scheduledSourcesRef.current.clear();

    setStatus(LiveStatus.DISCONNECTED);
    setIsUserSpeaking(false);
    setIsModelSpeaking(false);
    nextStartTimeRef.current = 0;
    
    processorRef.current = null;
    sourceNodeRef.current = null;
    inputAnalyserRef.current = null;
    outputAnalyserRef.current = null;
    audioStreamDestinationRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    if (status === LiveStatus.CONNECTED || status === LiveStatus.CONNECTING) return;

    try {
      setStatus(LiveStatus.CONNECTING);
      setTranscripts([]);
      setAgentActions([]);
      setLeads([]);
      setUserAudioBlob(null);
      audioChunksRef.current = [];
      
      // Safe access to API Key
      const apiKey = process.env.API_KEY;

      if (!apiKey) {
        console.error("API Key is missing.");
        setStatus(LiveStatus.ERROR);
        return;
      }
      
      // --- LOAD KNOWLEDGE BASE ---
      const knowledgeItems = await getKnowledgeItems();
      const activeKnowledge = knowledgeItems
        .filter(k => k.active)
        .map(k => `[TOPIC: ${k.title}]\n${k.content}`)
        .join('\n\n');

      const systemPrompt = `أنت "أليكس" (Alex)، وكيل مبيعات ومستشار قبول في "London Innovation Academy" (أكاديمية لندن للابتكار).

معلومات وحقائق أساسية عن الأكاديمية:
1. **الرؤية:** تمكين الشباب العربي بمهارات المستقبل من خلال تعليم عملي ومعتمد دولياً.
2. **إحصائيات:** أكثر من 750 طالب في العام الأول، وأكثر من 250 طالب يدرسون حالياً.
3. **الاعتمادات الدولية:** ISO 9001، UKRLP، و The CPD Group.
4. **الشراكات:** شراكة استراتيجية مع **وزارة الشباب والرياضة المصرية**.

--- قاعدة المعرفة الحالية (Knowledge Base) ---
استخدم المعلومات التالية بدقة للإجابة على الأسئلة:
${activeKnowledge}
---------------------------------------------

تفاصيل دبلومة تحليل البيانات المتقدمة (الافتراضية إذا لم تذكر في قاعدة المعرفة):
- **الأدوات:** Python, SQL, Excel, Power BI, Tableau.
- **السعر:** 3,800 كاش أو 4,000 تقسيط.

قدراتك كوكيل ذكي (Agent Capabilities):
1. **إجراء المكالمات (Outbound Calls):** يمكنك الاتصال بالطلاب. استخدم \`start_outbound_call\`.
2. **تسجيل البيانات (Forms):** لو العميل قال اسمه ورقمه أو أبدى اهتمام، سجل بياناته فوراً في السيستم باستخدام \`submit_lead_form\`.

تعليمات الشخصية والأسلوب:
1. **اللغة:** تحدث فقط باللهجة المصرية العامية (Masri).
2. **التعريف:** ابدأ بـ "أهلاً بيك في London Innovation Academy، أنا أليكس".
3. **التفاعل:** كن متعاوناً جداً. حاول دائماً الحصول على بيانات العميل (الاسم ورقم الهاتف) لتسجيله في السيستم.

المصادر الإضافية:
1. الموقع الرئيسي: https://london-innovation-academy.com/`;

      // Use browser default sample rate for input to avoid resampling artifacts/errors
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Output at 24kHz as per Gemini Live API requirement for playback, or system default
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // --- RECORDING SETUP (MIXED AUDIO) ---
      if (outputAudioContextRef.current) {
        const dest = outputAudioContextRef.current.createMediaStreamDestination();
        audioStreamDestinationRef.current = dest;

        // Add Mic to Mix
        const micSourceForRecord = outputAudioContextRef.current.createMediaStreamSource(stream);
        micSourceForRecord.connect(dest);

        // Determine supported MIME type for recording
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
           mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
           mimeType = 'audio/webm';
        }

        // Start Recording on Mixed Stream
        const recorder = mimeType ? new MediaRecorder(dest.stream, { mimeType }) : new MediaRecorder(dest.stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = () => {
          // Use the detected mimeType or fallback
          const finalMimeType = mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
          setUserAudioBlob(blob);
        };
        recorder.start();
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          tools: [
            { functionDeclarations: tools }
          ],
          systemInstruction: systemPrompt,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live API Connected');
            setStatus(LiveStatus.CONNECTED);

            if (!inputAudioContextRef.current || !mediaStreamRef.current) return;

            const inputCtx = inputAudioContextRef.current;
            const source = inputCtx.createMediaStreamSource(stream);
            sourceNodeRef.current = source;
            
            if (inputAnalyserRef.current) {
              source.connect(inputAnalyserRef.current);
            }

            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setIsUserSpeaking(rms > 0.02);

              // IMPORTANT: Pass the actual sample rate to createBlob
              const pcmBlob = createBlob(inputData, inputCtx.sampleRate);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              const functionResponses: any[] = [];
              message.toolCall.functionCalls.forEach((fc) => {
                console.log('Function triggered:', fc.name, fc.args);
                
                if (fc.name === 'start_outbound_call') {
                    const newAction: AgentAction = {
                        id: fc.id,
                        type: 'CALL',
                        details: `جاري الاتصال بـ ${fc.args.phoneNumber}...`,
                        status: 'completed',
                        timestamp: new Date()
                    };
                    setAgentActions(prev => [newAction, ...prev]);
                    functionResponses.push({
                        id: fc.id,
                        name: fc.name,
                        response: { result: "success", info: "Call initiated." }
                    });
                } else if (fc.name === 'submit_lead_form') {
                    const newLead: LeadForm = {
                        id: fc.id,
                        name: fc.args.name as string,
                        phone: fc.args.phone as string,
                        email: fc.args.email as string,
                        interest: fc.args.interest as string,
                        timestamp: new Date()
                    };
                    setLeads(prev => [newLead, ...prev]);
                    functionResponses.push({
                        id: fc.id,
                        name: fc.name,
                        response: { result: "success", info: "Lead saved to sheet." }
                    });
                } else {
                     functionResponses.push({
                        id: fc.id,
                        name: fc.name,
                        response: { result: "error", info: "Tool not supported" }
                     });
                }
              });
              if (functionResponses.length > 0) {
                sessionPromise.then((session) => {
                  session.sendToolResponse({ functionResponses });
                });
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              setIsModelSpeaking(true);
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              
              const gainNode = ctx.createGain();
              
              // 1. Connect to Analyser and Speakers
              if (outputAnalyserRef.current) {
                 source.connect(gainNode);
                 gainNode.connect(outputAnalyserRef.current);
                 outputAnalyserRef.current.connect(ctx.destination);
              } else {
                 source.connect(ctx.destination);
              }

              // 2. Connect to Recorder Mix
              if (audioStreamDestinationRef.current) {
                source.connect(audioStreamDestinationRef.current);
              }

              source.addEventListener('ended', () => {
                scheduledSourcesRef.current.delete(source);
                if (scheduledSourcesRef.current.size === 0) {
                    setIsModelSpeaking(false);
                }
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              scheduledSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              scheduledSourcesRef.current.forEach(s => s.stop());
              scheduledSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsModelSpeaking(false);
              currentOutputTranscription.current = ''; 
            }

            if (message.serverContent?.inputTranscription) {
               currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
               currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
                const userText = currentInputTranscription.current.trim();
                const modelText = currentOutputTranscription.current.trim();
                
                if (userText) {
                    setTranscripts(prev => [...prev, {
                        id: Math.random().toString(36).substring(7),
                        sender: 'user',
                        text: userText,
                        timestamp: new Date()
                    }]);
                }
                if (modelText) {
                    setTranscripts(prev => [...prev, {
                        id: Math.random().toString(36).substring(7),
                        sender: 'model',
                        text: modelText,
                        timestamp: new Date()
                    }]);
                }

                currentInputTranscription.current = '';
                currentOutputTranscription.current = '';
            }
          },
          onclose: (e) => {
            console.log('Connection closed', e);
            disconnect();
          },
          onerror: (err) => {
            console.error('Connection error', err);
            setStatus(LiveStatus.ERROR);
            disconnect();
          }
        }
      });

    } catch (error) {
      console.error("Failed to connect", error);
      setStatus(LiveStatus.ERROR);
    }
  }, [disconnect, status]);

  return {
    connect,
    disconnect,
    status,
    transcripts,
    agentActions,
    leads,
    isUserSpeaking,
    isModelSpeaking,
    inputAnalyser: inputAnalyserRef.current,
    outputAnalyser: outputAnalyserRef.current,
    userAudioBlob
  };
};
