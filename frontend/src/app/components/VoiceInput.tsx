import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

// Define the SpeechRecognition types
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
  onTranscript: (transcript: string) => void;
  onClose?: () => void;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, onClose }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognition, setRecognition] = useState<ISpeechRecognition | null>(null);

  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in your browser');
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

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
        setTranscript((prev) => prev + ' ' + final);
      }
    };

    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error:', event);
      toast.error('Voice input error. Please try again.');
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
  }, []);

  const startListening = async () => {
    if (!recognition) return;

    // Haptic feedback
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (error) {
        // Haptics not available
      }
    }

    try {
      setTranscript('');
      setInterimTranscript('');
      recognition.start();
      setIsListening(true);
      toast.success('Listening... Speak now');
    } catch (error) {
      console.error('Failed to start recognition:', error);
      toast.error('Failed to start voice input');
    }
  };

  const stopListening = async () => {
    if (!recognition) return;

    // Haptic feedback
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
      setTimeout(() => {
        onTranscript(transcript.trim());
        setIsProcessing(false);
        toast.success('Voice input processed');
      }, 500);
    }
  };

  const handleClear = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  const displayText = transcript + ' ' + interimTranscript;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 px-6 py-8 text-white text-center">
          <div className="flex justify-center mb-4">
            <motion.div
              animate={isListening ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`w-20 h-20 rounded-full flex items-center justify-center ${
                isListening ? 'bg-white/20 backdrop-blur-sm' : 'bg-white/10'
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
            {isListening ? 'Listening...' : isProcessing ? 'Processing...' : 'Tap to start'}
          </p>
        </div>

        {/* Transcript Display */}
        <div className="p-6 min-h-[120px] max-h-[200px] overflow-y-auto">
          {displayText.trim() ? (
            <div className="space-y-2">
              <p className="text-gray-900 text-lg leading-relaxed">
                {displayText}
              </p>
              {interimTranscript && (
                <p className="text-gray-400 text-sm italic">
                  (still listening...)
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              Your voice input will appear here...
            </p>
          )}
        </div>

        {/* Controls */}
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
            
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
