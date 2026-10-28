/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VehicleLevel } from '../types';

export const VEHICLE_CONFIGS: Record<VehicleLevel, {
  name: string;
  nameAmharic: string;
  defaultCapacity: number;
  modifier: number;
  description: string;
}> = {
  LEVEL_1: {
    name: 'Level 1 (Luxury Coach)',
    nameAmharic: 'ደረጃ 1 (የቅንጦት አውቶቡስ)',
    defaultCapacity: 45,
    modifier: 1.30,
    description: 'High-spec air conditioned cross-country coach with 45 spacious seats',
  },
  LEVEL_2: {
    name: 'Level 2 (Standard Mid-Tier)',
    nameAmharic: 'ደረጃ 2 (መደበኛ አውቶቡስ)',
    defaultCapacity: 60,
    modifier: 1.15,
    description: 'Standard inter-regional passenger fleet with 60 seats',
  },
  LEVEL_3: {
    name: 'Level 3 (Economy Transit)',
    nameAmharic: 'ደረጃ 3 (ኢኮኖሚ አውቶቡስ)',
    defaultCapacity: 60,
    modifier: 1.00,
    description: 'Economy transit minibus / regional coach with 60 seats',
  },
};

export const FIXED_TERMINAL_OVERHEAD_FEE = 10.00; // Fixed 10.00 ETB yard overhead per ticket

export interface FareCalculationResult {
  distanceKm: number;
  baseRatePerKm: number;
  baseRouteTariff: number; // distanceKm * baseRatePerKm
  levelModifier: number;
  subtotal: number; // baseRouteTariff * levelModifier
  terminalFee: number; // 10.00 ETB
  totalFare: number; // subtotal + terminalFee (rounded to 2 decimal places)
  terminalShare: number; // exactly 5% of totalFare
  operatorShare: number; // exactly 95% of totalFare
}

/**
 * Computes exact fare according to Ethiopian Transport Authority (ETA) tariff guidelines:
 * Total Fare (ETB) = (Base Route Tariff * Vehicle Level Modifier) + Terminal Station Overhead Fee
 */
export function calculateFare(
  distanceKm: number,
  baseRatePerKm: number,
  level: VehicleLevel
): FareCalculationResult {
  const levelModifier = VEHICLE_CONFIGS[level]?.modifier ?? 1.00;
  const rawBaseRouteTariff = distanceKm * baseRatePerKm;
  const rawSubtotal = rawBaseRouteTariff * levelModifier;
  const rawTotal = rawSubtotal + FIXED_TERMINAL_OVERHEAD_FEE;

  // Exact 2 decimal places precision (ACID standard from PRD 3.3.10)
  const baseRouteTariff = Number(rawBaseRouteTariff.toFixed(2));
  const subtotal = Number(rawSubtotal.toFixed(2));
  const totalFare = Number(rawTotal.toFixed(2));

  // 5% Terminal administrative maintenance fee and 95% operator share
  const terminalShare = Number((totalFare * 0.05).toFixed(2));
  const operatorShare = Number((totalFare - terminalShare).toFixed(2));

  return {
    distanceKm,
    baseRatePerKm,
    baseRouteTariff,
    levelModifier,
    subtotal,
    terminalFee: FIXED_TERMINAL_OVERHEAD_FEE,
    totalFare,
    terminalShare,
    operatorShare,
  };
}

/**
 * Calculates time-bounded ticket refund based on departure window:
 * - If requested >= 30 minutes before departure: refund permitted with 10% administrative cancellation fee
 * - If requested < 30 minutes before departure: refund rejected (PRD Section 3.2.4 V & UC-21)
 */
export function calculateCancellationRefund(
  totalFare: number,
  departureTimeISO: string,
  nowEpoch: number = Date.now()
): { eligible: boolean; refundAmount: number; penaltyAmount: number; reason?: string } {
  const departureEpoch = new Date(departureTimeISO).getTime();
  const diffMinutes = (departureEpoch - nowEpoch) / (1000 * 60);

  if (diffMinutes < 30) {
    return {
      eligible: false,
      refundAmount: 0,
      penaltyAmount: 0,
      reason: 'Cancellation rejected: Trip departs in less than 30 minutes. Ticket locked.',
    };
  }

  // 10% policy cancellation penalty
  const penaltyAmount = Number((totalFare * 0.10).toFixed(2));
  const refundAmount = Number((totalFare - penaltyAmount).toFixed(2));

  return {
    eligible: true,
    refundAmount,
    penaltyAmount,
  };
}
