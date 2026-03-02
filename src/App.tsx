import React, { useState } from 'react';
import {
  Truck,
  MapPin,
  Settings2,
  Plus,
  Zap,
  ChevronRight,
  Fuel,
  Navigation,
  Clock,
  Route,
  Trash2,
  GripVertical,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Home,
  History,
  Map as MapIcon,
  ExternalLink,
  LocateFixed,
  Save
} from 'lucide-react';
import { MapView } from './components/MapView';
import { ImportModal } from './components/ImportModal';
import { CheckoutModal } from './components/CheckoutModal';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { SortableStopItem } from './components/SortableStopItem';
import { useRouteCalculator } from './hooks/useRouteCalculator';
import { VehicleType, FuelType, TripHistory, Stop } from './types';
import { getGoogleMapsUrl } from './services/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export default function App() {
  const {
    stops,
    setStops,
    baseStop,
    updateBaseStop,
    updateBaseToCurrentLocation,
    isRoundTrip,
    toggleRoundTrip,
    avoidUnpaved,
    toggleAvoidUnpaved,
    vehicleConfig,
    setVehicleConfig,
    routeData,
    financialSummary,
    tolls,
    setTolls,
    manualDistanceKm,
    setManualDistanceKm,
    setRouteData,
    isLoading,
    loadingMessage,
    progress,
    handleOptimize,
    handleImport,
    reorderStops,
    updateRoute
  } = useRouteCalculator();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stops.findIndex((s) => s.id === active.id);
      const newIndex = stops.findIndex((s) => s.id === over.id);

      const newStops = arrayMove(stops, oldIndex, newIndex).map((s: Stop, idx: number) => ({
        ...s,
        order: idx
      }));

      reorderStops(newStops);
    }
  };

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<TripHistory[]>([]);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('rota_limpa_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading history', e);
      }
    }
  }, []);

  const saveToHistory = () => {
    const newTrip: TripHistory = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      config: vehicleConfig,
      summary: financialSummary,
      stops: stops
    };
    const newHistory = [newTrip, ...history];
    setHistory(newHistory);
    localStorage.setItem('rota_limpa_history', JSON.stringify(newHistory));
  };

  const deleteHistoryItem = (id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem('rota_limpa_history', JSON.stringify(newHistory));
  };

  const clearRoute = () => {
    if (confirm('Tem certeza que deseja limpar toda a rota atual?')) {
      setStops([]);
      setRouteData(null);
      setTolls(0);
      setManualDistanceKm(null);
      localStorage.removeItem('rota_limpa_stops');
      localStorage.removeItem('rota_limpa_routeData');
      localStorage.removeItem('rota_limpa_tolls');
      localStorage.removeItem('rota_limpa_manualDistanceKm');
    }
  };

  const handleFinalize = () => {
    const kmReal = prompt('Digite o KM Real Rodado (ou deixe em branco para usar o estimado):', financialSummary.totalDistanceKm.toFixed(1));
    if (kmReal !== null) {
      if (kmReal.trim() !== '') {
        setManualDistanceKm(parseFloat(kmReal.replace(',', '.')));
      }
      setIsCheckoutOpen(true);
      saveToHistory();
    }
  };

  const handleGoogleMaps = () => {
    if (window.navigator.vibrate) window.navigator.vibrate(10);
    const url = getGoogleMapsUrl(stops, isRoundTrip, baseStop);
    if (url) window.open(url, '_blank');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const removeStop = (id: string) => {
    const newStops = stops.filter(s => s.id !== id);
    setStops(newStops);
    updateRoute(newStops);
  };

  const [activeTab, setActiveTab] = useState<'form' | 'map'>('form');
  const [isOptimizingSuccess, setIsOptimizingSuccess] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOptimizeClick = async () => {
    if (window.navigator.vibrate) window.navigator.vibrate(15);
    const success = await handleOptimize();

    if (success) {
      // Show success state briefly
      setIsOptimizingSuccess(true);

      setTimeout(() => {
        setIsOptimizingSuccess(false);
        setActiveTab('map');

        // Force a small resize event to ensure Leaflet map renders correctly after tab switch
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 300);
      }, 1500); // Wait 1.5s to show the success animation
    }
  };

  const handleImportClick = async (text: string) => {
    await handleImport(text);
    setActiveTab('map');
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-zinc-950 font-sans overflow-hidden">
      <AnimatePresence>
        {isLoading && !isOptimizingSuccess && (
          <LoadingOverlay
            key="loading-overlay"
            isVisible={isLoading}
            message={loadingMessage}
            progress={progress.total > 0 ? progress : undefined}
          />
        )}
        {isOptimizingSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-6 text-center overflow-hidden"
          >
            {/* Background cinematic effect - Deep space feel */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.15, 0.3, 0.15]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#0f172a_0%,_#000_100%)]"
              />
              <motion.div
                animate={{
                  x: [-100, 100],
                  y: [-50, 50],
                  opacity: [0, 0.2, 0]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,_#10b981_0%,_transparent_40%)] blur-[100px]"
              />
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
            </div>

            <div className="relative z-10">
              <motion.div
                initial={{ scale: 0.7, opacity: 0, rotateY: -110 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 80, duration: 1.2 }}
                className="w-56 h-56 bg-gradient-to-br from-brand-emerald/10 to-blue-600/5 rounded-[40px] border border-white/10 flex items-center justify-center mb-14 relative backdrop-blur-md shadow-2xl"
              >
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 30px rgba(16,185,129,0.1)",
                      "0 0 80px rgba(16,185,129,0.4)",
                      "0 0 30px rgba(16,185,129,0.1)"
                    ],
                    borderColor: [
                      "rgba(255,255,255,0.1)",
                      "rgba(16,185,129,0.4)",
                      "rgba(255,255,255,0.1)"
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 rounded-[40px] border"
                />

                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.6, type: "spring", bounce: 0.7, duration: 0.8 }}
                >
                  <CheckCircle className="w-28 h-28 text-brand-emerald drop-shadow-[0_0_20px_rgba(16,185,129,1)]" />
                </motion.div>

                {/* Orbital ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-20px] border border-dashed border-brand-emerald/20 rounded-full"
                />
              </motion.div>

              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.h2
                  animate={{
                    letterSpacing: ["0.2em", "0.35em", "0.2em"],
                    textShadow: [
                      "0 0 15px rgba(16,185,129,0.4)",
                      "0 0 40px rgba(16,185,129,0.7)",
                      "0 0 15px rgba(16,185,129,0.4)"
                    ]
                  }}
                  transition={{ duration: 5, repeat: Infinity }}
                  className="text-8xl font-black tracking-widest text-white uppercase italic mb-8 flex flex-col items-center justify-center"
                >
                  <span className="text-3xl not-italic font-bold tracking-[0.8em] text-zinc-600 mb-4 opacity-60">SISTEMA</span>
                  <div className="relative">
                    ROTA <span className="text-brand-emerald">ELITE</span>
                    <motion.div
                      animate={{ left: ['-10%', '110%'], opacity: [0, 1, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                      className="absolute top-0 bottom-0 w-1 bg-brand-emerald/50 blur-sm"
                    />
                  </div>
                </motion.h2>

                <div className="flex items-center justify-center gap-6 mb-12">
                  <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-brand-emerald/50 to-transparent" />
                  <div className="flex gap-2">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.3, 1, 0.3]
                        }}
                        transition={{ duration: 1.5, delay: i * 0.15, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-brand-emerald shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                      />
                    ))}
                  </div>
                  <div className="h-[1px] w-24 bg-gradient-to-l from-transparent via-brand-emerald/50 to-transparent" />
                </div>

                <div className="relative inline-block">
                  <p className="text-zinc-500 font-black uppercase tracking-[0.8em] text-[11px] opacity-70 max-w-lg mx-auto leading-relaxed">
                    Logística Avançada • Otimização de Percurso • Máxima Eficiência
                  </p>
                  <motion.div
                    animate={{ width: ['0%', '100%', '0%'] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute -bottom-2 left-0 h-[1px] bg-brand-emerald/30"
                  />
                </div>
              </motion.div>
            </div>

            {/* Tech frame corners */}
            <div className="absolute inset-10 pointer-events-none border border-white/5 rounded-[40px]">
              <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-brand-emerald/30 rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-brand-emerald/30 rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-brand-emerald/30 rounded-bl-3xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-brand-emerald/30 rounded-br-3xl" />
            </div>

            {/* Scanning line effect - More subtle and techy */}
            <motion.div
              animate={{ top: ['-10%', '110%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-emerald/40 to-transparent z-0"
            />

            {/* Particles or tech accents */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [0, -100],
                    opacity: [0, 1, 0],
                    x: [0, (i - 2) * 50]
                  }}
                  transition={{
                    duration: 2 + Math.random(),
                    repeat: Infinity,
                    delay: i * 0.4
                  }}
                  className="absolute bottom-0 left-1/2 w-1 h-1 bg-brand-emerald rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar (Form) */}
      <aside className={`
        w-full md:w-[400px] lg:w-[450px] bg-zinc-900 border-r border-zinc-800 flex flex-col z-10 shadow-2xl
        ${activeTab === 'form' ? 'flex' : 'hidden md:flex'}
        h-full
      `}>
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-blue/10 rounded-lg">
              <Truck className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white leading-none">ROTA LIMPA</h1>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Logística Inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Histórico"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Configurações de Custo"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Base / Origin Section */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-brand-blue" />
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ponto de Partida</h3>
              </div>
              <button
                onClick={updateBaseToCurrentLocation}
                className="text-[10px] font-bold text-brand-blue hover:text-blue-400 uppercase flex items-center gap-1"
              >
                <LocateFixed className="w-3 h-3" /> GPS
              </button>
            </div>
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between group hover:border-zinc-700 transition-colors">
              <p className="text-xs text-zinc-300 truncate font-medium flex-1 mr-3">
                {baseStop?.address || 'Localizando...'}
              </p>
              <button
                onClick={() => {
                  const newAddr = prompt('Digite o endereço da base:', baseStop?.address);
                  if (newAddr) updateBaseStop(newAddr);
                }}
                className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase shrink-0"
              >
                Alterar
              </button>
            </div>
          </section>

          {/* Summary Dashboard */}
          {stops.length > 0 && (
            <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4 shadow-xl">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-brand-emerald" /> Lucro Líquido
                  </p>
                  <p className="text-2xl font-black text-brand-emerald tracking-tight">
                    {formatCurrency(financialSummary.netProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-brand-blue" /> Frete Total
                  </p>
                  <p className="text-xl font-bold text-white tracking-tight">
                    {formatCurrency(financialSummary.revenue)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-zinc-800/50">
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold mb-0.5">Distância</p>
                  <p className="text-xs font-bold text-zinc-300">
                    {financialSummary.totalDistanceKm.toFixed(1)} <span className="text-[10px] font-normal text-zinc-500">km</span>
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold mb-0.5">Duração</p>
                  <p className="text-xs font-bold text-zinc-300">
                    {Math.round(financialSummary.totalDurationMin)} <span className="text-[10px] font-normal text-zinc-500">min</span>
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold mb-0.5">Pedágios</p>
                  <p className={`text-xs font-bold ${routeData?.tollCount ? 'text-red-400' : 'text-zinc-500'}`}>
                    {routeData?.tollCount || 0}
                  </p>
                </div>
              </div>

              {/* Route Options Toggles */}
              <div className="flex items-center gap-4 pt-4 mt-4 border-t border-zinc-800/50">
                <button
                  onClick={toggleRoundTrip}
                  className="flex items-center gap-2 group"
                >
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${isRoundTrip ? 'bg-brand-blue' : 'bg-zinc-800'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isRoundTrip ? 'left-4.5' : 'left-0.5'}`} />
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${isRoundTrip ? 'text-brand-blue' : 'text-zinc-500 group-hover:text-zinc-400'}`}>Ida e Volta</span>
                </button>

                <button
                  onClick={toggleAvoidUnpaved}
                  className="flex items-center gap-2 group"
                >
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${avoidUnpaved ? 'bg-brand-orange' : 'bg-zinc-800'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${avoidUnpaved ? 'left-4.5' : 'left-0.5'}`} />
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${avoidUnpaved ? 'text-brand-orange' : 'text-zinc-500 group-hover:text-zinc-400'}`}>Evitar Terra</span>
                </button>
              </div>
            </section>
          )}

          {/* Unpaved Road Warning */}
          {routeData?.totalUnpavedDistance !== undefined && routeData.totalUnpavedDistance > 0 && (
            <div className="p-3 bg-brand-orange/10 border border-brand-orange/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-brand-orange uppercase">Estradas de Terra Detectadas</p>
                <p className="text-[10px] text-zinc-400 leading-tight mt-1">
                  Aprox. <span className="text-brand-orange font-bold">{(routeData.totalUnpavedDistance / 1000).toFixed(1)} km</span> de terra.
                  {!avoidUnpaved && ' Ative "Evitar Terra" para desviar.'}
                </p>
              </div>
            </div>
          )}

          {/* Stops List */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Paradas ({stops.length})
              </h3>
              <div className="flex items-center gap-2">
                {stops.length > 0 && (
                  <button
                    onClick={clearRoute}
                    className="text-[10px] font-bold text-red-500/70 hover:text-red-500 uppercase transition-colors"
                  >
                    Limpar
                  </button>
                )}
                <button
                  onClick={() => setIsImportOpen(true)}
                  className="text-[10px] font-bold text-brand-blue hover:text-blue-400 uppercase flex items-center gap-1 bg-brand-blue/10 px-2 py-1 rounded-md"
                >
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={stops.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <AnimatePresence mode="popLayout">
                    {stops.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-8 border-2 border-dashed border-zinc-800/50 rounded-2xl flex flex-col items-center justify-center text-center gap-3 bg-zinc-950/50"
                      >
                        <MapPin className="w-8 h-8 text-zinc-700" />
                        <p className="text-xs text-zinc-500 font-medium">Nenhuma parada adicionada.<br />Clique em Adicionar para começar.</p>
                        <button
                          onClick={() => setIsImportOpen(true)}
                          className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          Importar Endereços
                        </button>
                      </motion.div>
                    ) : (
                      stops.map((stop: Stop, index: number) => (
                        <SortableStopItem
                          key={stop.id}
                          stop={stop}
                          index={index}
                          onRemove={removeStop}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </SortableContext>
              </DndContext>
            </div>
          </section>

          {/* Tolls Details Section */}
          {routeData?.tolls && routeData.tolls.length > 0 && (
            <section className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Pedágios ({routeData.tolls.length})</h3>
                </div>
                <button
                  onClick={async () => {
                    const text = `🛣️ *Solicitação de Sem Parar*\n\n*Total de Praças:* ${routeData.tolls!.length}\n\n*Localizações:*\n${routeData.tolls!.map((t, i) => `${i + 1}. ${t.name}`).join('\n')}`;
                    try {
                      await navigator.clipboard.writeText(text);
                      alert('Lista de pedágios copiada!');
                    } catch (err) {
                      const textArea = document.createElement("textarea");
                      textArea.value = text;
                      document.body.appendChild(textArea);
                      textArea.select();
                      try {
                        document.execCommand('copy');
                        alert('Lista de pedágios copiada!');
                      } catch (e) {
                        alert('Não foi possível copiar automaticamente.');
                      }
                      document.body.removeChild(textArea);
                    }
                  }}
                  className="text-[9px] font-bold text-amber-500 hover:text-amber-400 uppercase bg-amber-500/10 px-2 py-1 rounded"
                >
                  Copiar Lista
                </button>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {routeData.tolls.map((toll, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="text-[9px] font-bold text-amber-500/50 w-4">{index + 1}.</span>
                    <span className="truncate">{toll.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-zinc-950 border-t border-zinc-800 space-y-3 shrink-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5">
          {stops.length > 2 && (
            <button
              onClick={handleOptimizeClick}
              disabled={isLoading}
              className="w-full py-4 bg-brand-emerald hover:bg-emerald-600 active:scale-95 disabled:opacity-30 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/10"
            >
              <Zap className="w-5 h-5 fill-current" /> Otimizar Rota
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleGoogleMaps}
              disabled={stops.length < 1 || isLoading}
              className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 active:scale-95 disabled:opacity-30 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-wider"
            >
              <MapIcon className="w-5 h-5 text-zinc-400" /> Navegar
            </button>
            <button
              onClick={() => {
                if (window.navigator.vibrate) window.navigator.vibrate(10);
                handleFinalize();
              }}
              disabled={stops.length < 1 || isLoading}
              className="w-full py-4 bg-brand-blue hover:bg-blue-600 active:scale-95 disabled:opacity-30 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-wider shadow-xl shadow-blue-500/10"
            >
              Relatório <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Map Content */}
      <main className={`
        flex-1 relative bg-zinc-900
        ${activeTab === 'map' ? 'flex' : 'hidden md:flex'}
        h-full
      `}>
        <MapView
          key={stops.length === 0 ? 'empty' : 'active'}
          stops={stops}
          baseStop={baseStop}
          routeData={routeData}
          isRoundTrip={isRoundTrip}
          activeTab={activeTab}
        />

        {/* Floating Status */}
        <div className="absolute top-6 right-6 z-10 flex flex-col gap-2">
          {isLoading && (
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 px-4 py-2 rounded-full flex items-center gap-2 text-xs font-medium shadow-2xl">
              <div className="w-2 h-2 bg-brand-blue rounded-full animate-pulse" />
              Calculando melhor rota...
            </div>
          )}
          {stops.length > 0 && !isLoading && (
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 px-4 py-2 rounded-full flex items-center gap-2 text-xs font-medium shadow-2xl">
              <CheckCircle className="w-3 h-3 text-brand-emerald" />
              {stops.length} paradas mapeadas
            </div>
          )}
        </div>
      </main>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 w-full max-w-[320px]">
        <div className="relative bg-zinc-950 border border-zinc-800 p-1 rounded-[24px] flex items-center shadow-2xl">
          {/* Robust Sliding Indicator - Percentage based for GPU stability */}
          <div className="absolute inset-1 w-[calc(50%-4px)] overflow-hidden pointer-events-none">
            <motion.div
              initial={false}
              animate={{ x: activeTab === 'form' ? '0%' : '100%' }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className="w-full h-full bg-brand-blue rounded-full shadow-[0_0_15px_rgba(59,130,246,0.4)]"
            />
          </div>

          <button
            onClick={() => {
              if (window.navigator.vibrate) window.navigator.vibrate(5);
              setActiveTab('form');
            }}
            className={`
              relative flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2.5 z-10
              ${activeTab === 'form' ? 'text-white' : 'text-zinc-500 hover:text-white'}
            `}
          >
            <Settings2 className="w-4 h-4" />
            Painel
          </button>
          <button
            onClick={() => {
              if (window.navigator.vibrate) window.navigator.vibrate(5);
              setActiveTab('map');
              setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
            }}
            className={`
              relative flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2.5 z-10
              ${activeTab === 'map' ? 'text-white' : 'text-zinc-500 hover:text-white'}
            `}
          >
            <MapIcon className="w-4 h-4" />
            Mapa
          </button>
        </div>
      </div>

      {/* Modals */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onStartImport={handleImportClick}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        stops={stops}
        baseStop={baseStop}
        summary={financialSummary}
        config={vehicleConfig}
        isRoundTrip={isRoundTrip}
        manualDistanceKm={manualDistanceKm}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onDelete={deleteHistoryItem}
        onView={(trip) => {
          setStops(trip.stops);
          setVehicleConfig(trip.config);
          setTolls(trip.summary.tolls);
          setManualDistanceKm(trip.summary.totalDistanceKm);
          setIsHistoryOpen(false);
          updateRoute(trip.stops);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={vehicleConfig}
        onConfigChange={setVehicleConfig}
        tolls={tolls}
        onTollsChange={setTolls}
        tollCount={routeData?.tollCount}
      />
    </div>
  );
}
