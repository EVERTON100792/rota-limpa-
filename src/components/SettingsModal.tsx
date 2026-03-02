import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings2, Truck, Droplets, Receipt, MapPin, Save, ChevronRight } from 'lucide-react';
import { VehicleConfig, VehicleType, FuelType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VehicleConfig;
  onConfigChange: (config: VehicleConfig) => void;
  tolls: number;
  onTollsChange: (tolls: number) => void;
  tollCount?: number;
}

export function SettingsModal({
  isOpen,
  onClose,
  config,
  onConfigChange,
  tolls,
  onTollsChange,
  tollCount
}: SettingsModalProps) {
  const triggerHaptic = () => {
    if (window.navigator.vibrate) window.navigator.vibrate(10);
  };

  const handleSave = () => {
    triggerHaptic();
    onClose();
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 p-4"
          />

          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-0 md:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-zinc-900 border-t md:border border-zinc-800 w-full max-w-md rounded-t-[32px] md:rounded-2xl shadow-2xl z-50 overflow-hidden pointer-events-auto mt-auto md:mt-0 max-h-[92vh] flex flex-col"
            >
              {/* Mobile Handle */}
              <div className="md:hidden flex justify-center py-3">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
              </div>

              <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-blue/10 rounded-xl">
                    <Settings2 className="w-6 h-6 text-brand-blue" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white leading-none">Configurações</h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 font-black">Cálculo de Custos</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-zinc-500 hover:text-white transition-colors bg-zinc-800/50 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
                {/* Vehicle Settings */}
                <section>
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1">
                    <Truck className="w-4 h-4" /> Veículo
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider px-1">Modelo</label>
                      <select
                        value={config.type}
                        onChange={(e) => onConfigChange({ ...config, type: e.target.value as VehicleType })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all appearance-none"
                      >
                        <option value="Fiorino">Fiorino</option>
                        <option value="Van">Van</option>
                        <option value="Caminhão">Caminhão</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider px-1">Consumo (km/L)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={config.consumption}
                        onChange={(e) => onConfigChange({ ...config, consumption: parseFloat(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                      />
                    </div>
                  </div>
                </section>

                {/* Fuel Settings */}
                <section>
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1">
                    <Droplets className="w-4 h-4" /> Combustível
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider px-1">Tipo</label>
                      <select
                        value={config.fuelType}
                        onChange={(e) => onConfigChange({ ...config, fuelType: e.target.value as FuelType })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all appearance-none"
                      >
                        <option value="Gasolina">Gasolina</option>
                        <option value="Etanol">Etanol</option>
                        <option value="Diesel">Diesel</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider px-1">Preço/Litro (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.fuelPrice}
                        onChange={(e) => onConfigChange({ ...config, fuelPrice: parseFloat(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                      />
                    </div>
                  </div>
                </section>

                {/* Financial Settings */}
                <section>
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1">
                    <Receipt className="w-4 h-4" /> Financeiro
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider px-1">Frete (R$/km)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={config.freightRate}
                        onChange={(e) => onConfigChange({ ...config, freightRate: parseFloat(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider px-1 flex items-center justify-between">
                        <span>Pedágios (R$)</span>
                        {tollCount !== undefined && tollCount > 0 && (
                          <span className="text-[9px] text-brand-orange font-black bg-brand-orange/10 px-2 py-0.5 rounded-full">
                            {tollCount} na rota
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        value={tolls}
                        onChange={(e) => onTollsChange(parseFloat(e.target.value) || 0)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-3 px-1 italic">
                    * Preencha pedágios apenas se não forem reembolsados.
                  </p>
                </section>
              </div>

              <div className="p-6 bg-zinc-950 border-t border-zinc-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <button
                  onClick={handleSave}
                  className="w-full py-4 bg-brand-blue hover:bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Salvar Configurações
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
