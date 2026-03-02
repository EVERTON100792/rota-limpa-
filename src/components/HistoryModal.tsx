import React from 'react';
import { X, Calendar, MapPin, TrendingUp, Trash2, FileText, ChevronRight } from 'lucide-react';
import { TripHistory } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: TripHistory[];
  onDelete: (id: string) => void;
  onView: (trip: TripHistory) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onDelete, onView }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const triggerHaptic = () => {
    if (window.navigator.vibrate) window.navigator.vibrate(10);
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja excluir esta viagem do histórico?')) {
      triggerHaptic();
      onDelete(id);
    }
  };

  const handleView = (trip: TripHistory) => {
    triggerHaptic();
    onView(trip);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4"
          />

          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-0 md:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-zinc-900 border-t md:border border-zinc-800 w-full max-w-4xl rounded-t-[32px] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto mt-auto md:mt-0 max-h-[92vh]"
            >
              {/* Mobile Handle */}
              <div className="md:hidden flex justify-center py-3">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
              </div>

              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-blue/10 rounded-xl">
                    <Calendar className="w-6 h-6 text-brand-blue" />
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Histórico de Viagens</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-zinc-500 hover:text-white transition-colors bg-zinc-800/50 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                    <div className="p-6 bg-zinc-800/50 rounded-full">
                      <FileText className="w-12 h-12 text-zinc-600" />
                    </div>
                    <div>
                      <p className="text-zinc-400 font-bold text-lg">Nenhuma viagem salva</p>
                      <p className="text-zinc-600 text-sm">Suas rotas finalizadas aparecerão aqui.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                    {history.map((trip) => (
                      <div
                        key={trip.id}
                        className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-zinc-700 transition-all flex flex-col active:scale-[0.98]"
                      >
                        <div className="p-4 border-b border-zinc-800/50 flex justify-between items-start bg-zinc-950/20">
                          <div>
                            <p className="text-[10px] font-black text-brand-blue uppercase tracking-[0.2em] mb-1">
                              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(trip.date))}
                            </p>
                            <p className="font-bold text-white text-base">{trip.config.type} <span className="text-zinc-500 font-medium">({trip.stops.length} paradas)</span></p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(trip.id); }}
                            className="p-3 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-4 grid grid-cols-2 gap-4 bg-zinc-950/40" onClick={() => handleView(trip)}>
                          <div>
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Distância</p>
                            <p className="text-sm font-bold text-white">{trip.summary.totalDistanceKm.toFixed(1)} <span className="text-[10px] text-zinc-500 font-medium">km</span></p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Lucro Líquido</p>
                            <p className="text-sm font-bold text-brand-emerald">{formatCurrency(trip.summary.netProfit)}</p>
                          </div>
                        </div>

                        <div className="p-4 bg-zinc-900/30 flex justify-between items-center cursor-pointer hover:bg-zinc-800/40 transition-colors" onClick={() => handleView(trip)}>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate pr-2 font-medium">{trip.stops[0].address}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-brand-blue shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-zinc-950 border-t border-zinc-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-zinc-900 border border-zinc-800 text-white rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all hover:bg-zinc-800"
                >
                  Fechar Histórico
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
