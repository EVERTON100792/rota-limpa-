import React from 'react';
import { X, FileText, Share2, Download, CheckCircle2, MapPin, TrendingUp, Fuel, Wallet, Map as MapIcon, Route, Home } from 'lucide-react';
import { Stop, FinancialSummary, VehicleConfig } from '../types';
import { getGoogleMapsUrl } from '../services/utils';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  stops: Stop[];
  baseStop: Stop | null;
  summary: FinancialSummary;
  config: VehicleConfig;
  isRoundTrip?: boolean;
  manualDistanceKm?: number | null;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  stops,
  baseStop,
  summary,
  config,
  isRoundTrip = false,
  manualDistanceKm = null
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const triggerHaptic = () => {
    if (window.navigator.vibrate) window.navigator.vibrate(10);
  };

  const handleGoogleMaps = () => {
    triggerHaptic();
    const url = getGoogleMapsUrl(stops, isRoundTrip, baseStop);
    if (url) window.open(url, '_blank');
  };

  const handleWhatsApp = () => {
    triggerHaptic();
    const mapsUrl = getGoogleMapsUrl(stops, isRoundTrip, baseStop);
    const text = `*Resumo da Viagem - Rota Limpa*%0A%0A` +
      `📍 *Paradas:* ${stops.length}%0A` +
      `🔄 *Tipo:* ${isRoundTrip ? 'Ida e Volta' : 'Apenas Ida'}%0A` +
      `🛣️ *Distância:* ${summary.totalDistanceKm.toFixed(1)} km%0A` +
      `⏱️ *Duração:* ${Math.round(summary.totalDurationMin)} min%0A%0A` +
      `💰 *Financeiro:*%0A` +
      `- Frete: ${formatCurrency(summary.revenue)}%0A` +
      `- Combustível: ${formatCurrency(summary.fuelCost)}%0A` +
      `- Pedágios: ${formatCurrency(summary.tolls)}%0A` +
      `✅ *Lucro Líquido: ${formatCurrency(summary.netProfit)}*%0A%0A` +
      `🗺️ *Rota no Maps:* ${mapsUrl}`;

    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handlePDF = () => {
    triggerHaptic();
    const doc = new jsPDF();
    const dateStr = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('ROTA LIMPA', 14, 20);
    doc.setFontSize(10);
    doc.text('Relatório Detalhado de Viagem e Custos', 14, 30);

    // Info Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Data da Viagem: ${dateStr}`, 14, 50);
    doc.text(`Veículo: ${config.type} (${config.fuelType})`, 14, 56);
    doc.text(`Consumo Médio: ${config.consumption} km/L`, 14, 62);
    doc.text(`Preço Combustível: ${formatCurrency(config.fuelPrice)}/L`, 14, 68);

    // Financial Table
    const summaryData = [
      ['Distância Total', `${summary.totalDistanceKm.toFixed(1)} km`],
      ['Duração Estimada', `${Math.round(summary.totalDurationMin)} min`],
      ['Valor do Frete (Receita)', formatCurrency(summary.revenue)],
      ['Custo de Combustível', formatCurrency(summary.fuelCost)],
      ['Gastos com Pedágios', formatCurrency(summary.tolls)],
      ['LUCRO LÍQUIDO', formatCurrency(summary.netProfit)],
    ];

    (doc as any).autoTable({
      startY: 75,
      head: [['Métrica de Custos', 'Valor']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 }
    });

    // Itinerary Table
    const itineraryHead = [['#', 'Tipo', 'Endereço Completo']];
    const itineraryBody = [];

    if (baseStop) itineraryBody.push(['-', 'PARTIDA', baseStop.address]);
    stops.forEach((s, i) => itineraryBody.push([i + 1, 'ENTREGA', s.address]));
    if (isRoundTrip && baseStop) itineraryBody.push(['-', 'RETORNO', baseStop.address]);

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: itineraryHead,
      body: itineraryBody,
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 30 },
        2: { cellWidth: 'auto' }
      }
    });

    doc.save(`relatorio-rota-limpa-${Date.now()}.pdf`);
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
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4"
          />

          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-0 md:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-zinc-900 border-t md:border border-zinc-800 w-full max-w-3xl rounded-t-[32px] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto mt-auto md:mt-0 max-h-[92vh]"
            >
              {/* Mobile Handle */}
              <div className="md:hidden flex justify-center py-3">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
              </div>

              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-emerald/10 rounded-xl">
                    <CheckCircle2 className="w-6 h-6 text-brand-emerald" />
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Viagem Finalizada</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-zinc-500 hover:text-white transition-colors bg-zinc-800/50 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                {/* Financial Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className={`p-4 bg-zinc-950 border rounded-2xl ${manualDistanceKm ? 'border-brand-orange/30' : 'border-zinc-800'}`}>
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-2">
                      <Route className="w-3 h-3" /> Distância
                    </div>
                    <div className="text-xl font-bold text-white">
                      {summary.totalDistanceKm.toFixed(1)}
                      <span className="text-xs font-normal text-zinc-500 ml-1">km</span>
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-2">
                      <Wallet className="w-3 h-3" /> Receita
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">{formatCurrency(summary.revenue)}</div>
                  </div>
                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-2">
                      <Fuel className="w-3 h-3" /> Custos
                    </div>
                    <div className="text-xl font-bold text-red-400 tracking-tight">{formatCurrency(summary.fuelCost + summary.tolls)}</div>
                  </div>
                  <div className="p-4 bg-brand-emerald/10 border border-brand-emerald/20 rounded-2xl">
                    <div className="flex items-center gap-2 text-brand-emerald text-[10px] font-black uppercase tracking-wider mb-2">
                      <TrendingUp className="w-3 h-3" /> Lucro Líquido
                    </div>
                    <div className="text-xl font-bold text-brand-emerald tracking-tight">{formatCurrency(summary.netProfit)}</div>
                  </div>
                </div>

                {/* Route Summary */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">Itinerário Final</h3>
                  <div className="space-y-2">
                    {baseStop && (
                      <div className="flex items-start gap-4 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                        <div className="w-8 h-8 rounded-xl bg-brand-blue/20 flex items-center justify-center text-brand-blue shrink-0">
                          <Home className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-black text-brand-blue uppercase tracking-widest bg-brand-blue/10 px-2 py-0.5 rounded-full mb-1 inline-block">Partida (Base)</span>
                          <div className="text-sm text-zinc-300 leading-snug break-words">{baseStop.address}</div>
                        </div>
                      </div>
                    )}
                    {stops.map((stop, idx) => (
                      <div key={stop.id} className="flex items-start gap-4 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                        <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 font-black text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-800/50 px-2 py-0.5 rounded-full mb-1 inline-block">Entrega {idx + 1}</span>
                          <div className="text-sm text-zinc-300 leading-snug break-words">{stop.address}</div>
                        </div>
                      </div>
                    ))}
                    {isRoundTrip && baseStop && (
                      <div className="flex items-start gap-4 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                        <div className="w-8 h-8 rounded-xl bg-brand-blue/20 flex items-center justify-center text-brand-blue shrink-0">
                          <Home className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-black text-brand-blue uppercase tracking-widest bg-brand-blue/10 px-2 py-0.5 rounded-full mb-1 inline-block">Retorno (Base)</span>
                          <div className="text-sm text-zinc-300 leading-snug break-words">{baseStop.address}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-950 border-t border-zinc-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleGoogleMaps}
                    className="px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                  >
                    <MapIcon className="w-5 h-5" /> Google Maps
                  </button>
                  <button
                    onClick={handleWhatsApp}
                    className="px-6 py-4 bg-brand-emerald hover:bg-emerald-600 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-500/10"
                  >
                    <Share2 className="w-5 h-5" /> WhatsApp
                  </button>
                </div>
                <button
                  onClick={handlePDF}
                  className="w-full px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all"
                >
                  <Download className="w-4 h-4" /> Baixar Relatório PDF
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
