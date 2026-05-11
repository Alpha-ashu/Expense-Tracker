import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { CenteredLayout } from "@/app/components/shared/CenteredLayout";
import { parseVoiceExpense, parseMultipleTransactions } from "@/lib/voiceExpenseParser";
import { resolveLanguageCode } from "@/lib/userPreferences";
import { persistVoiceRouteDraft, writeVoiceBatchDraft } from "@/lib/voiceDrafts";
import { processVoiceTranscript } from "@/services/voiceFinancialService";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

interface VoiceInputProps {
  onTranscript?: (transcript: string) => void;
  onClose?: () => void;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, onClose }) => {
  const { language, setCurrentPage } = useApp();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognition, setRecognition] = useState<ISpeechRecognition | null>(null);

  const resolveRecognitionLocale = (appLanguage: string) => {
    const languageCode = resolveLanguageCode(appLanguage);
    const localeMap: Record<string, string> = {
      en: "en-US",
      hi: "hi-IN",
      bn: "bn-IN",
      ta: "ta-IN",
      te: "te-IN",
      mr: "mr-IN",
      gu: "gu-IN",
      kn: "kn-IN",
      ml: "ml-IN",
      pa: "pa-IN",
      ur: "ur-PK",
      es: "es-ES",
      fr: "fr-FR",
      de: "de-DE",
    };

    return localeMap[languageCode] || "en-US";
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input is not supported in your browser");
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    // Optimized recognition settings for faster response
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = resolveRecognitionLocale(language);

    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimTranscript(interim);
      if (final) {
        setTranscript((prev) => prev + " " + final);
      }
    };

    recognitionInstance.onerror = (event) => {
      console.error("Speech recognition error:", event);
      toast.error("Voice input error. Please try again.");
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    setRecognition(recognitionInstance);

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, [language]);

  const startListening = async () => {
    if (!recognition) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (error) {
        // Haptics not available
      }
    }

    try {
      setTranscript("");
      setInterimTranscript("");
      recognition.start();
      setIsListening(true);
      toast.success("Listening... Speak now");
    } catch (error) {
      console.error("Failed to start recognition:", error);
      toast.error("Failed to start voice input");
    }
  };

  const stopListening = async () => {
    if (!recognition) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        // Haptics not available
      }
    }

    recognition.stop();
    setIsListening(false);

    if (transcript.trim()) {
      setIsProcessing(true);
      
      const processTranscript = async () => {
        try {
          if (onTranscript) {
            onTranscript(transcript.trim());
            return;
          }

          // Try backend NLP first for richer intent understanding
          let usedBackendNLP = false;
          try {
            const result = await processVoiceTranscript(transcript.trim());
            if (result.success && result.totalActions > 0) {
              usedBackendNLP = true;
              if (result.totalActions === 1 && !result.requiresReview) {
                const action = result.actions[0];
                // Route to appropriate form with pre-filled data
                const draft = {
                  amount: action.entities.amount,
                  description: action.entities.description,
                  category: action.entities.category,
                  merchant: action.entities.merchant,
                  date: action.entities.date,
                  type: action.type === 'income' ? 'income' : 'expense',
                };
                setCurrentPage(persistVoiceRouteDraft(draft));
              } else {
                // Multiple actions or needs review — go to review page
                writeVoiceBatchDraft(result.actions.map((a) => ({
                  type: (a.type as any),
                  amount: a.entities.amount,
                  description: a.entities.description ?? a.rawSegment,
                  category: a.entities.category,
                  merchant: a.entities.merchant,
                  confidence: a.confidence,
                })));
                setCurrentPage("voice-review");
              }
              return;
            }
          } catch (backendErr) {
            // Backend failed, fall back to local parser
            console.warn('[VoiceInput] Backend NLP failed, using local parser:', backendErr);
          }

          // Local parser fallback
          if (!usedBackendNLP) {
            const transactions = parseMultipleTransactions(transcript.trim());
            if (transactions.length === 0) {
              const parsed = parseVoiceExpense(transcript.trim());
              if (!parsed.amount) {
                toast.error("Could not detect amount. Please try again.");
                return;
              }
              setCurrentPage(persistVoiceRouteDraft(parsed));
            } else if (transactions.length === 1) {
              setCurrentPage(persistVoiceRouteDraft(transactions[0]));
            } else {
              writeVoiceBatchDraft(transactions);
              setCurrentPage("voice-review");
            }
          }
        } catch (error) {
          console.error('Voice processing error:', error);
          toast.error("Failed to process voice input. Please try again.");
        } finally {
          setIsProcessing(false);
        }
      };
      
      setTimeout(processTranscript, 200);
    }
  };

  const handleClear = () => {
    setTranscript("");
    setInterimTranscript("");
  };

  const displayText = transcript + " " + interimTranscript;

  if (onClose) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 px-6 py-8 text-white text-center">
            <div className="flex justify-center mb-4">
              <motion.div
                animate={isListening ? { scale: [1, 1.2, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className={`w-20 h-20 rounded-full flex items-center justify-center ${
                  isListening ? "bg-white/20 backdrop-blur-sm" : "bg-white/10"
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="w-10 h-10 animate-spin" />
                ) : isListening ? (
                  <Mic className="w-10 h-10" />
                ) : (
                  <MicOff className="w-10 h-10" />
                )}
              </motion.div>
            </div>
            <h3 className="text-2xl font-bold mb-2">Voice Input</h3>
            <p className="text-pink-100">
              {isListening ? "Listening..." : isProcessing ? "Analyzing Financial Activities..." : "Tap to start"}
            </p>
          </div>

          <div className="p-6 min-h-[120px] max-h-[200px] overflow-y-auto">
            {displayText.trim() ? (
              <div className="space-y-2">
                <p className="text-gray-900 text-lg leading-relaxed">{displayText}</p>
                {interimTranscript && (
                  <p className="text-gray-400 text-sm italic">(still listening...)</p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">Your voice input will appear here...</p>
            )}
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex gap-3">
              {isListening ? (
                <button
                  onClick={stopListening}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <MicOff size={20} />
                  Stop
                </button>
              ) : (
                <button
                  onClick={startListening}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-pink-600 text-white rounded-xl font-medium hover:bg-pink-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Mic size={20} />
                  Start
                </button>
              )}

              {transcript && !isListening && (
                <button
                  onClick={handleClear}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  Clear
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-3xl px-6 py-8 text-white text-center">
          <div className="flex justify-center mb-4">
            <motion.div
              animate={isListening ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`w-20 h-20 rounded-full flex items-center justify-center ${
                isListening ? "bg-white/20 backdrop-blur-sm" : "bg-white/10"
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : isListening ? (
                <Mic className="w-10 h-10" />
              ) : (
                <MicOff className="w-10 h-10" />
              )}
            </motion.div>
          </div>
          <h3 className="text-2xl font-bold mb-2">Voice Entry</h3>
          <p className="text-pink-100">
            {isListening ? "Listening..."
              : isProcessing
                ? "Analyzing Financial Activities..."
                : "Speak your expenses (e.g., \"Food 500 and Uber 200\")"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 min-h-[180px] border border-gray-200">
          {displayText.trim() ? (
            <div className="space-y-2">
              <p className="text-gray-900 text-lg leading-relaxed">{displayText}</p>
              {interimTranscript && (
                <p className="text-gray-400 text-sm italic">(still listening...)</p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-12">Describe your transactions and it will appear here...</p>
          )}
        </div>

        <div className="space-y-3">
          {isListening ? (
            <button
              onClick={stopListening}
              className="w-full py-4 bg-red-600 text-white rounded-2xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <MicOff size={24} />
              Stop Listening
            </button>
          ) : (
            <button
              onClick={startListening}
              disabled={isProcessing}
              className="w-full py-4 bg-pink-600 text-white rounded-2xl font-semibold hover:bg-pink-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <Mic size={24} />
              {isProcessing ? "Processing..." : "Start Listening"}
            </button>
          )}

          {transcript && !isListening && (
            <button
              onClick={handleClear}
              className="w-full py-3 bg-gray-200 text-gray-700 rounded-2xl font-medium hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </CenteredLayout>
  );
};

