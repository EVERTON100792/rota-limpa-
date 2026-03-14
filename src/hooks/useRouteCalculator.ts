import { useState, useMemo, useEffect, useRef } from 'react';
import { Stop, VehicleConfig, FinancialSummary, RouteData, Expense } from '../types';
import { getRoute, optimizeRoute } from '../services/osrmService';
import { normalizeAddresses, geocodeAddress, sleep } from '../services/geocodingService';

export const useRouteCalculator = () => {
  const [stops, setStops] = useState<Stop[]>(() => {
    const saved = localStorage.getItem('rota_limpa_stops');
    return saved ? JSON.parse(saved) : [];
  });
  const [baseStop, setBaseStop] = useState<Stop | null>(() => {
    const saved = localStorage.getItem('rota_limpa_baseStop');
    return saved ? JSON.parse(saved) : null;
  });
  const [isRoundTrip, setIsRoundTrip] = useState(() => {
    const saved = localStorage.getItem('rota_limpa_isRoundTrip');
    return saved ? JSON.parse(saved) : true;
  });
  const [vehicleConfig, setVehicleConfig] = useState<VehicleConfig>(() => {
    const saved = localStorage.getItem('rota_limpa_vehicleConfig');
    return saved ? JSON.parse(saved) : {
      type: 'Fiorino',
      fuelType: 'Gasolina',
      fuelPrice: 5.80,
      consumption: 12,
      freightRate: 2.50
    };
  });
  const [routeData, setRouteData] = useState<RouteData | null>(() => {
    const saved = localStorage.getItem('rota_limpa_routeData');
    return saved ? JSON.parse(saved) : null;
  });
  const [tolls, setTolls] = useState(() => {
    const saved = localStorage.getItem('rota_limpa_tolls');
    return saved ? JSON.parse(saved) : 0;
  });
  const [manualDistanceKm, setManualDistanceKm] = useState<number | null>(() => {
    const saved = localStorage.getItem('rota_limpa_manualDistanceKm');
    return saved ? JSON.parse(saved) : null;
  });
  const [avoidUnpaved, setAvoidUnpaved] = useState(() => {
    const saved = localStorage.getItem('rota_limpa_avoidUnpaved');
    return saved ? JSON.parse(saved) : false;
  });
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('rota_limpa_expenses');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('rota_limpa_stops', JSON.stringify(stops));
  }, [stops]);

  useEffect(() => {
    if (baseStop) {
      localStorage.setItem('rota_limpa_baseStop', JSON.stringify(baseStop));
    }
  }, [baseStop]);

  useEffect(() => {
    localStorage.setItem('rota_limpa_isRoundTrip', JSON.stringify(isRoundTrip));
  }, [isRoundTrip]);

  useEffect(() => {
    localStorage.setItem('rota_limpa_vehicleConfig', JSON.stringify(vehicleConfig));
  }, [vehicleConfig]);

  useEffect(() => {
    if (routeData) {
      localStorage.setItem('rota_limpa_routeData', JSON.stringify(routeData));
    } else {
      localStorage.removeItem('rota_limpa_routeData');
    }
  }, [routeData]);

  useEffect(() => {
    localStorage.setItem('rota_limpa_tolls', JSON.stringify(tolls));
  }, [tolls]);

  useEffect(() => {
    localStorage.setItem('rota_limpa_manualDistanceKm', JSON.stringify(manualDistanceKm));
  }, [manualDistanceKm]);

  useEffect(() => {
    localStorage.setItem('rota_limpa_avoidUnpaved', JSON.stringify(avoidUnpaved));
  }, [avoidUnpaved]);

  useEffect(() => {
    localStorage.setItem('rota_limpa_expenses', JSON.stringify(expenses));
  }, [expenses]);

  // Initialize base stop with current location if possible and not already set
  useEffect(() => {
    const savedBaseStr = localStorage.getItem('rota_limpa_baseStop');
    if (savedBaseStr) {
      try {
        const savedBase = JSON.parse(savedBaseStr);
        // If the saved base was set automatically by GPS, update it to the new current location
        if (savedBase.isAutoGPS) {
          updateBaseToCurrentLocation();
        }
      } catch (e) {
        // ignore parse error
      }
      return;
    }
    updateBaseToCurrentLocation();
  }, []);

  // Calculate financial summary in real-time
  const financialSummary = useMemo((): FinancialSummary => {
    const estimatedDistanceKm = (routeData?.distance || 0) / 1000;
    const distanceKm = manualDistanceKm !== null && manualDistanceKm > 0
      ? manualDistanceKm
      : estimatedDistanceKm;

    const durationMin = (routeData?.duration || 0) / 60;

    // Revenue = Distance * Freight Rate (R$/km)
    const revenue = distanceKm * vehicleConfig.freightRate;
    // Fuel Cost = (Distance / Consumption) * Fuel Price
    const fuelCost = (distanceKm / vehicleConfig.consumption) * vehicleConfig.fuelPrice;
    
    // Total Expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Net Profit = Revenue - Fuel Cost - Tolls - totalExpenses
    const netProfit = revenue - fuelCost - tolls - totalExpenses;

    return {
      totalDistanceKm: distanceKm,
      totalDurationMin: durationMin,
      fuelCost,
      revenue,
      tolls,
      totalExpenses,
      netProfit
    };
  }, [routeData, vehicleConfig, tolls, manualDistanceKm, expenses]);

  // Keep track of ongoing operations to allow cancellation
  const routeAbortController = useRef<AbortController | null>(null);
  const optimizeAbortController = useRef<AbortController | null>(null);

  const getSignal = (ref: { current: AbortController | null }) => {
    if (ref.current) {
      ref.current.abort();
    }
    ref.current = new AbortController();
    return ref.current.signal;
  };

  const updateRoute = async (currentStops: Stop[], currentBase: Stop | null = baseStop, roundTrip: boolean = isRoundTrip, shouldAvoidUnpaved: boolean = avoidUnpaved) => {
    if (!currentBase || currentStops.length === 0) {
      setRouteData(null);
      return;
    }

    const signal = getSignal(routeAbortController);
    setIsLoading(true);
    setLoadingMessage('Traçando rota...');

    // Route always starts at base
    const stopsForRoute = [currentBase, ...currentStops];
    if (roundTrip) {
      stopsForRoute.push(currentBase);
    }

    try {
      const data = await getRoute(stopsForRoute, shouldAvoidUnpaved, signal);
      
      // Check if this request was superseded or cancelled
      if (signal.aborted) return;

      if (data) {
        setRouteData(data);
      } else {
        setRouteData(null);
        alert("Falha ao traçar a rota. Tente novamente em alguns instantes.");
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error("Erro fatal ao calcular rota:", error);
      setRouteData(null);
      alert("Erro ao calcular a rota. Por favor, tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (text: string) => {
    setIsLoading(true);
    setLoadingMessage('Analisando endereços...');

    try {
      const normalized = await normalizeAddresses(text);
      if (normalized.length === 0) {
        setIsLoading(false);
        return;
      }

      setLoadingMessage('Geocodificando pontos...');
      setProgress({ current: 0, total: normalized.length });

      const newStops: Stop[] = [];
      const failedAddresses: string[] = [];

      for (let i = 0; i < normalized.length; i++) {
        setProgress({ current: i + 1, total: normalized.length });
        const item = normalized[i];
        const result = await geocodeAddress(
          item.clean,
          baseStop?.lat,
          baseStop?.lng
        );

        if (result && result.lat && result.lng) {
          newStops.push({
            id: crypto.randomUUID(),
            address: item.original || result.address || item.clean,
            geocodedAddress: result.address,
            lat: result.lat,
            lng: result.lng,
            order: i
          });
        } else {
          failedAddresses.push(item.original);
        }

        if (i < normalized.length - 1) await sleep(1100);
      }

      if (failedAddresses.length > 0) {
        alert(`⚠️ Atenção: Os seguintes endereços não foram encontrados ou estão digitados incorretamente:\n\n${failedAddresses.join('\n')}\n\nPor favor, revise-os e tente adicioná-los novamente com mais detalhes (ex: Rua, Número, Bairro, Cidade).`);
      }

      if (newStops.length > 0) {
        setStops(newStops);
        setLoadingMessage('Otimizando sequência...');
        
        // Auto-optimize after import, passing the brand new stops directly 
        // to avoid waiting for the async setStops state update
        if (newStops.length >= 2) {
          const optimized = await handleOptimize(newStops);
          if (!optimized) {
            await updateRoute(newStops);
          }
        } else {
          await updateRoute(newStops);
        }
      }
    } catch (e) {
      console.error("Error during import:", e);
      alert("Ocorreu um erro ao importar os endereços. Por favor, tente novamente.");
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleOptimize = async (stopsToOptimize?: Stop[]): Promise<boolean> => {
    const currentStops = stopsToOptimize || stops;
    if (!baseStop || currentStops.length < 2) return false;

    const signal = getSignal(optimizeAbortController);
    setIsLoading(true);
    setRouteData(null); // Clear old route data immediately
    setLoadingMessage('Otimizando sequência...');

    try {
      // Optimize starting from base
      const data = await optimizeRoute([baseStop, ...currentStops], avoidUnpaved, isRoundTrip, signal);
      if (data) {
        // The first stop in optimized data will be the base (since it's the first in the input)
        // We extract the rest as deliveries
        const optimizedDeliveries = data.stops.slice(1).map((s: Stop, idx: number) => ({ ...s, order: idx }));
        setStops(optimizedDeliveries);

        // Re-run updateRoute to handle roundTrip geometry correctly
        await updateRoute(optimizedDeliveries, baseStop, isRoundTrip, avoidUnpaved);
        return true;
      }
      return false;
    } catch (e: any) {
      if (e.name === 'AbortError') return false;
      console.error("Optimization failed:", e);
      alert("Falha ao otimizar a rota. O servidor pode estar indisponível.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const reorderStops = async (newStops: Stop[]) => {
    setStops(newStops);
    await updateRoute(newStops);
  };

  const toggleAvoidUnpaved = () => {
    const newVal = !avoidUnpaved;
    setAvoidUnpaved(newVal);
    updateRoute(stops, baseStop, isRoundTrip, newVal);
  };

  const toggleRoundTrip = () => {
    const newVal = !isRoundTrip;
    setIsRoundTrip(newVal);
    updateRoute(stops, baseStop, newVal);
  };

  const updateBaseStop = async (address: string) => {
    setIsLoading(true);
    setLoadingMessage('Atualizando base...');
    const result = await geocodeAddress(address);
    if (result && result.lat && result.lng) {
      const newBase: Stop = {
        id: 'base-origin',
        address: address, // Always use what the user typed, not the huge Nominatim string
        geocodedAddress: result.address,
        lat: result.lat,
        lng: result.lng,
        order: -1
      };
      setBaseStop(newBase);
      updateRoute(stops, newBase);
    }
    setIsLoading(false);
  };

  const updateBaseToCurrentLocation = async () => {
    if ("geolocation" in navigator) {
      setIsLoading(true);
      setLoadingMessage('Obtendo localização atual...');
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();

          let addressName = 'Localização Atual';
          if (data && data.address) {
            const addr = data.address;
            const street = addr.road || addr.pedestrian || addr.suburb || '';
            const number = addr.house_number || '';
            const city = addr.city || addr.town || addr.village || '';

            const parts = [];
            if (street) parts.push(number ? `${street}, ${number}` : street);
            if (city) parts.push(city);

            if (parts.length > 0) {
              addressName = parts.join(' - ');
            }
          }

          const newBase: Stop = {
            id: 'base-origin',
            address: addressName,
            geocodedAddress: data.display_name,
            lat: latitude,
            lng: longitude,
            order: -1,
            isAutoGPS: true
          };
          setBaseStop(newBase);
          updateRoute(stops, newBase);
        } catch (e) {
          const newBase: Stop = {
            id: 'base-origin',
            address: 'Localização Atual',
            lat: latitude,
            lng: longitude,
            order: -1,
            isAutoGPS: true
          };
          setBaseStop(newBase);
          updateRoute(stops, newBase);
        } finally {
          setIsLoading(false);
        }
      }, (error) => {
        console.error("Erro ao obter localização:", error);
        alert("Não foi possível obter sua localização atual. Verifique se o GPS está ativado e se você concedeu permissão.");
        setIsLoading(false);
      });
    } else {
      alert("Geolocalização não é suportada pelo seu navegador.");
    }
  };

  return {
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
    updateRoute,
    expenses,
    setExpenses
  };
};
