import type { Berth } from './types';

export const BERTHS: { v: Berth; l: string }[] = [
  { v: 'NP', l: 'No preference' },
  { v: 'LB', l: 'Lower' },
  { v: 'MB', l: 'Middle' },
  { v: 'UB', l: 'Upper' },
  { v: 'SL', l: 'Side lower' },
  { v: 'SU', l: 'Side upper' },
  { v: 'WS', l: 'Window (chair car)' },
];

export const berthLabel = (b: Berth) => BERTHS.find((x) => x.v === b)?.l ?? b;
