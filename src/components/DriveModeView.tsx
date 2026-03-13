import React from 'react';
import { X, Plus, Zap, MapPin } from 'lucide-react';
import { FinancialSummary, Stop } from '../types';

interface DriveModeViewProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: () => void;
  summary: FinancialSummary;
  stops: Stop[];
}

export function DriveModeView({ isOpen, onClose, onAddExpense, summary, stops }: DriveModeViewProps) {
  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm pointer-events-none flex flex-col justify-between">
      {/* Top Header */}
      <div className="p-4 sm:p-6 flex justify-between items-start pointer-events-auto">
        <div className="bg-black/90 border border-zinc-800 p-4 rounded-3xl shadow-2xl flex items-center gap-4">
          <div className="w-4 h-4 bg-brand-emerald rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
          <div>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Modo Direção</p>
            <p className="text-2xl font-black text-brand-emerald leading-none tracking-tighter">
              {formatCurrency(summary.netProfit)}
            </p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-16 h-16 bg-black/90 border border-zinc-800 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
        >
          <X className="w-8 h-8" />
        </button>
      </div>

      {/* Bottom Controls */}
      <div className="p-4 sm:p-6 pb-8 pointer-events-auto">
        <div className="grid grid-cols-12 gap-4">
           {/* Add Expense - Big Button */}
           <button 
             onClick={onAddExpense}
             className="col-span-12 py-6 bg-brand-red hover:bg-red-600 border border-red-500 rounded-3xl text-white font-black text-2xl uppercase tracking-widest flex items-center justify-center gap-4 shadow-[0_0_30px_rgba(239,68,68,0.2)] active:scale-95 transition-all"
           >
             <Plus className="w-8 h-8" /> Despesa
           </button>
        </div>
      </div>
    </div>
  );
}
