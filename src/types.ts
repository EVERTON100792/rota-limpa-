/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VehicleType = 'Fiorino' | 'Van' | 'Caminhão';
export type FuelType = 'Gasolina' | 'Etanol' | 'Diesel';

export interface VehicleConfig {
  type: VehicleType;
  fuelType: FuelType;
  fuelPrice: number;
  consumption: number; // km/L
  freightRate: number; // R$ per KM
}

export interface Stop {
  id: string;
  address: string;
  geocodedAddress?: string;
  lat: number;
  lng: number;
  order: number;
  isAutoGPS?: boolean;
}

export interface RouteData {
  distance: number; // meters
  duration: number; // seconds
  geometry: string; // polyline
  stops: Stop[];
  tollCount?: number;
  tolls?: { lat: number; lng: number; name: string }[];
  unpavedSegments?: { coordinates: [number, number][]; distance: number }[];
  totalUnpavedDistance?: number;
}

export interface Expense {
  id: string;
  type: 'Combustível' | 'Alimentação' | 'Manutenção' | 'Pedágio Extra' | 'Outro';
  amount: number;
  description: string;
  date: string;
  photoDataUrl?: string; // base64 representation of the photo
}

export interface FinancialSummary {
  totalDistanceKm: number;
  totalDurationMin: number;
  fuelCost: number;
  revenue: number;
  tolls: number;
  totalExpenses: number;
  netProfit: number;
}

export interface TripHistory {
  id: string;
  date: string;
  config: VehicleConfig;
  summary: FinancialSummary;
  stops: Stop[];
  expenses: Expense[];
}
