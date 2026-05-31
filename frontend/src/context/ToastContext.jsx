import { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  const icons = {
    success: <Check size={16} className="text-emerald-500" />,
    error: <AlertTriangle size={16} className="text-rose-500" />,
    info: <Info size={16} className="text-blue-500" />,
  };

  const borders = {
    success: "rgba(16, 185, 129, 0.3)",
    error: "rgba(244, 63, 94, 0.3)",
    info: "rgba(59, 130, 246, 0.3)",
  };

  const backgrounds = {
    success: "rgba(16, 185, 129, 0.08)",
    error: "rgba(244, 63, 94, 0.08)",
    info: "rgba(59, 130, 246, 0.08)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl relative overflow-hidden backdrop-blur-xl"
      style={{
        background: "rgba(10, 15, 30, 0.85)",
        border: `1px solid ${borders[toast.type]}`,
        minWidth: "300px",
        maxWidth: "400px",
      }}
    >
      <div 
        className="absolute inset-0 opacity-50"
        style={{ background: backgrounds[toast.type] }}
      />
      <div 
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 relative z-10"
        style={{ background: backgrounds[toast.type], border: `1px solid ${borders[toast.type]}` }}
      >
        {icons[toast.type]}
      </div>
      <div className="flex-1 relative z-10 pt-1.5">
        <p className="text-sm font-medium text-white leading-tight">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="relative z-10 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors mt-0.5"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};
