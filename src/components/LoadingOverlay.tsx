import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Navigation, MapPin, Orbit } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: { current: number; total: number };
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = "Otimizando sua rota...", progress }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="relative mb-16 flex items-center justify-center">
            {/* Background glow base */}
            <div className="absolute inset-0 bg-brand-blue/10 rounded-full blur-3xl w-64 h-64 -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 pointer-events-none" />

            {/* Cyber Radar Rings */}
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 rounded-full border border-zinc-800/80 animate-[spin_4s_linear_infinite]">
                {/* Radar scanner sweep */}
                <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,rgba(59,130,246,0.2)_360deg)] rounded-full" />

                {/* Radar tick marks */}
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-2 bg-zinc-800/80 top-0 left-1/2 -translate-x-1/2 origin-[50%_80px]"
                    style={{ transform: `rotate(${i * 45}deg)` }}
                  />
                ))}
              </div>

              <div className="absolute inset-4 rounded-full border border-dashed border-brand-blue/30 animate-[spin_8s_linear_reverse_infinite]" />

              <div className="absolute inset-10 bg-zinc-900/80 rounded-full border border-brand-blue/40 flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <Orbit className="w-8 h-8 text-brand-blue" />
              </div>

              {/* Floating icons */}
              <div className="absolute -top-4 -right-4 p-2 bg-zinc-900 border border-brand-blue/30 rounded-xl shadow-lg z-10 animate-bounce">
                <Sparkles className="w-4 h-4 text-brand-emerald" />
              </div>
              <div className="absolute -bottom-4 -left-4 p-2 bg-zinc-900 border border-brand-blue/30 rounded-xl shadow-lg z-10 animate-bounce" style={{ animationDelay: '0.5s' }}>
                <Navigation className="w-4 h-4 text-brand-orange" />
              </div>
            </div>
          </div>

          <div
            className="space-y-4 max-w-md relative z-20"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-blue/10 border border-brand-blue/20 rounded-full mb-2">
              <MapPin className="w-3.5 h-3.5 text-brand-blue" />
              <span className="text-[10px] font-bold text-brand-blue uppercase tracking-widest">IA de Roteirização Ativa</span>
            </div>

            <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">
              {message}
            </h2>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-[280px] mx-auto">
              Nossa <span className="text-zinc-300 font-bold">inteligência artificial</span> está processando trilhões de variáveis para encontrar o trajeto perfeito.
            </p>

            {progress && (
              <div className="mt-8 space-y-3 w-64 mx-auto">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Processamento</span>
                  <span className="text-lg font-black text-brand-blue drop-shadow-sm">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
                </div>

                {/* Simple CSS-transition ProgressBar */}
                <div className="relative h-2 w-full bg-zinc-900 rounded-sm overflow-hidden border border-zinc-800/80">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-blue via-blue-400 to-brand-emerald transition-all duration-300 ease-out"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>

                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                  Analisando parada <span className="text-zinc-400">{progress.current}</span> de <span className="text-zinc-400">{progress.total}</span>
                </p>
              </div>
            )}
          </div>

          {/* Lightweight Grid Background (Solid without masks/heavy gradients) */}
          <div
            className="absolute inset-0 -z-10 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, #ffffff 1px, transparent 1px),
                linear-gradient(to bottom, #ffffff 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
