import React, { useState } from 'react';
import { X, Clipboard, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartImport: (text: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onStartImport }) => {
  const [text, setText] = useState('');

  const handleStart = () => {
    if (text.trim().length < 5) return;

    // Add haptic feedback if available
    if (window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }

    onStartImport(text);
    onClose();
    setText('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 pointer-events-none flex items-center md:items-center justify-center p-0 md:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-zinc-900 border-t md:border border-zinc-800 w-full max-w-2xl rounded-t-[32px] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto mt-auto md:mt-0 max-h-[90vh]"
            >
              {/* Mobile Handle */}
              <div className="md:hidden flex justify-center py-3">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
              </div>

              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-blue/10 rounded-xl">
                    <Clipboard className="w-6 h-6 text-brand-blue" />
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Importar Endereços</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-zinc-500 hover:text-white transition-colors bg-zinc-800/50 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="p-4 bg-brand-blue/5 border border-brand-blue/10 rounded-2xl flex items-start gap-3">
                  <Zap className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    <strong className="text-brand-blue">Dica:</strong> Você pode colar mensagens do WhatsApp, listas de Excel ou textos bagunçados. <strong className="text-white">Também aceitamos listas de CEPs com o número do local (ex: 01001-000, 150)!</strong> Nosso sistema irá limpar e organizar tudo automaticamente para você.
                  </p>
                </div>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Cole aqui sua lista de endereços..."
                  className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm font-mono focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue outline-none transition-all resize-none placeholder:text-zinc-700 text-white"
                />
              </div>

              <div className="p-6 bg-zinc-950 border-t border-zinc-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <div className="flex flex-col-reverse md:flex-row justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="px-6 py-4 md:py-2.5 text-sm font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={text.trim().length < 5}
                    className="px-8 py-4 bg-brand-blue hover:bg-blue-600 disabled:opacity-30 disabled:grayscale text-white rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    Começar Otimização
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
