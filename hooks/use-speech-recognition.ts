"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// Type for SpeechRecognition (browser API)
type SpeechRecognitionType = typeof window.SpeechRecognition extends undefined 
  ? typeof window.webkitSpeechRecognition 
  : typeof window.SpeechRecognition;

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  pauseListening: () => void;
  resumeListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  // biome-ignore lint/suspicious/noExplicitAny: SpeechRecognition type varies by browser
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);

  // Check browser support on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create new recognition instance
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      // biome-ignore lint/suspicious/noExplicitAny: SpeechRecognitionEvent type varies by browser
      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript(finalTranscript.trim());
          setInterimTranscript("");
        } else {
          setInterimTranscript(interim);
        }
      };

      // biome-ignore lint/suspicious/noExplicitAny: SpeechRecognitionErrorEvent type varies by browser
      recognition.onerror = (event: any) => {
        // Handle different error types appropriately
        switch (event.error) {
          case "not-allowed":
            console.error("Speech recognition error:", event.error);
            setError("Microphone permission denied. Please allow microphone access and try again.");
            setIsListening(false);
            shouldRestartRef.current = false;
            break;
          case "no-speech":
            // This is normal - user hasn't spoken yet, just continue listening silently
            break;
          case "aborted":
            // User or system aborted, don't show error
            break;
          case "audio-capture":
            console.error("Speech recognition error:", event.error);
            setError("No microphone detected. Please connect a microphone.");
            break;
          case "network":
            console.error("Speech recognition error:", event.error);
            setError("Network error occurred. Please check your connection.");
            break;
          default:
            console.warn("Speech recognition warning:", event.error);
            // Don't show error for unknown/minor issues, just log
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        
        // Auto-restart if should continue
        if (shouldRestartRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Ignore if already started
          }
        }
      };

      recognitionRef.current = recognition;
      shouldRestartRef.current = true;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else {
        setError("Failed to access microphone. Please check your permissions.");
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const pauseListening = useCallback(() => {
    // Temporarily stop recognition without clearing the ref
    // This prevents picking up TTS audio as user input
    if (recognitionRef.current) {
      shouldRestartRef.current = false; // Prevent auto-restart
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const resumeListening = useCallback(() => {
    // Resume recognition after TTS playback
    if (recognitionRef.current) {
      shouldRestartRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Ignore if already started or other issues
        console.warn("Could not resume speech recognition:", e);
      }
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    resetTranscript,
  };
}
