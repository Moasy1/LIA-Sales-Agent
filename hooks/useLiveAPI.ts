import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import { LiveStatus, TranscriptItem, AgentAction } from '../types';

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
    name: 'send_whatsapp_message',
    description: 'Send a WhatsApp message with course details, pricing, or brochures.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        phoneNumber: {
          type: Type.STRING,
          description: 'The phone number to send the message to.',
        },
        messageContent: {
          type: Type.STRING,
          description: 'The content of the message.',
        },
        attachment: {
          type: Type.STRING,
          description: 'Optional link to PDF or brochure to attach.',
        },
      },
      required: ['phoneNumber', 'messageContent'],
    },
  },
];

export const useLiveAPI = () => {
  const [status, setStatus] = useState<LiveStatus>(LiveStatus.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]); // New state for actions
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  
  // Refs for audio contexts and processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  const disconnect = useCallback(() => {
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
  }, []);

  const connect = useCallback(async () => {
    if (status === LiveStatus.CONNECTED || status === LiveStatus.CONNECTING) return;

    try {
      setStatus(LiveStatus.CONNECTING);
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          // Integrate Tools here
          tools: [
            { googleSearch: {} },
            { functionDeclarations: tools }
          ],
          systemInstruction: `أنت "أليكس" (Alex)، وكيل مبيعات ومستشار قبول في "أكاديمية لندن للابتكار" (London Innovation Academy).

معلومات وحقائق أساسية عن الأكاديمية:
1. **الرؤية:** تمكين الشباب العربي بمهارات المستقبل من خلال تعليم عملي ومعتمد دولياً.
2. **إحصائيات:** أكثر من 750 طالب في العام الأول، وأكثر من 250 طالب يدرسون حالياً.
3. **الاعتمادات الدولية:** ISO 9001، UKRLP، و The CPD Group.
4. **الشراكات:** شراكة استراتيجية مع **وزارة الشباب والرياضة المصرية**.

تفاصيل دبلومة تحليل البيانات المتقدمة (Advanced Data Analysis Diploma):
- **الأدوات:** Python, SQL, Excel, Power BI, Tableau.
- **السعر:** 3,800 كاش أو 4,000 تقسيط.

قدراتك كوكيل ذكي (Agent Capabilities):
1. **إجراء المكالمات (Outbound Calls):** يمكنك الاتصال بالطلاب لمتابعة الحجز أو الرد على الاستفسارات المعقدة. إذا طلب العميل مكالمة، استخدم الأداة \`start_outbound_call\`.
2. **إرسال واتساب (WhatsApp):** يمكنك إرسال تفاصيل الكورسات، البروشور، وروابط الدفع عبر واتساب. استخدم الأداة \`send_whatsapp_message\`.

تعليمات الشخصية والأسلوب:
1. **اللغة:** تحدث فقط باللهجة المصرية العامية (Masri).
2. **التعريف:** ابدأ بـ "أهلاً بيك، أنا أليكس".
3. **التفاعل:** لو العميل طلب تفاصيل مكتوبة، قوله "هبعتلك حالا على واتساب" واستخدم الأداة. لو العميل عايز يكلم حد بشري أو محتاج تفصيل أكتر، اعرض عليه تتصل بيه حالا واستخدم أداة الاتصال.

المصادر الإضافية:
1. الموقع الرئيسي: https://london-innovation-academy.com/
2. تفاصيل الدبلومات: https://london-innovation-academy.com/sale/data-analysis-diploma`,
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

              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls (Function Calling)
            if (message.toolCall) {
              const functionResponses: any[] = [];
              
              message.toolCall.functionCalls.forEach((fc) => {
                console.log('Function triggered:', fc.name, fc.args);
                
                // 1. Update UI State
                const newAction: AgentAction = {
                  id: fc.id,
                  type: fc.name === 'start_outbound_call' ? 'CALL' : 'WHATSAPP',
                  details: fc.name === 'start_outbound_call' 
                    ? `جاري الاتصال بـ ${fc.args.phoneNumber}...` 
                    : `إرسال واتساب لـ ${fc.args.phoneNumber}`,
                  status: 'completed', // In a real app, we'd wait for backend response
                  timestamp: new Date()
                };
                
                setAgentActions(prev => [newAction, ...prev]);

                // 2. Prepare Response for Gemini
                // In a real app, this is where you'd hit your Backend API (Twilio/Meta)
                functionResponses.push({
                  id: fc.id,
                  name: fc.name,
                  response: { result: "success", info: "Action executed successfully in CRM." }
                });
              });

              // 3. Send Tool Response back to Gemini
              if (functionResponses.length > 0) {
                sessionPromise.then((session) => {
                  session.sendToolResponse({ functionResponses });
                });
              }
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              setIsModelSpeaking(true);
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              
              const gainNode = ctx.createGain();
              if (outputAnalyserRef.current) {
                 source.connect(gainNode);
                 gainNode.connect(outputAnalyserRef.current);
                 outputAnalyserRef.current.connect(ctx.destination);
              } else {
                 source.connect(ctx.destination);
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

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
              scheduledSourcesRef.current.forEach(s => s.stop());
              scheduledSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsModelSpeaking(false);
              currentOutputTranscription.current = ''; 
            }

            // Handle Transcripts
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
          onclose: () => {
            console.log('Connection closed');
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
    isUserSpeaking,
    isModelSpeaking,
    inputAnalyser: inputAnalyserRef.current,
    outputAnalyser: outputAnalyserRef.current
  };
};