import React, { useEffect } from "react";
import { AlertCircle, CheckCircle2, X, Info } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "error" | "success" | "info";
  onClose: () => void;
  duration?: number;
}

export function Toast({
  message,
  type = "info",
  onClose,
  duration = 5000,
}: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const Icon =
    type === "error" ? AlertCircle : type === "success" ? CheckCircle2 : Info;

  return (
    <>
      <style>{`
        @keyframes toast-progress {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center min-w-[280px] max-w-[90vw] md:max-w-md min-h-[44px] z-[150] toast-popup overflow-hidden">
        
        {/* Animated bottom border progress */}
        <div 
          className="absolute bottom-0 left-0 h-[3px] bg-white/40"
          style={{ animation: `toast-progress ${duration}ms linear forwards` }}
        />

        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <Icon className="w-4 h-4" />
        </div>
        
        <span className="text-xs md:text-sm font-medium tracking-wide whitespace-normal text-center px-12 py-2">
          {message}
        </span>
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
