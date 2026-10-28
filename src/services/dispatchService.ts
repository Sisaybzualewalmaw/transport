/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppState,
  FIFOQueueEntry,
  ScheduledTrip,
  Vehicle,
} from '../types';
import { calculateFare, VEHICLE_CONFIGS } from './tariffEngine';
import { saveState } from '../store/transportStore';

/**
 * Terminal Check-In: Enrolls an arriving vehicle and driver into the route's FIFO queue array
 * PRD Reference: FR-FLM-03, UC-10, 4.7.2.1 Stage 1, SD-08
 */
export function enrollVehicleInFIFOQueue(
  state: AppState,
  terminalId: string,
  vehicleId: string,
  driverId: string,
  targetRouteId: string
): { updatedState: AppState; success: boolean; message: string; entry?: FIFOQueueEntry } {
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  const driver = state.drivers.find((d) => d.id === driverId);

  if (!vehicle) {
    return { updatedState: state, success: false, message: 'Vehicle record not found.' };
  }
  if (!driver) {
    return { updatedState: state, success: false, message: 'Driver record not found.' };
  }

  // Check if already active in queue
  const existingQueue = state.fifoQueues.find(
    (q) => q.vehicleId === vehicleId && q.status === 'QUEUED'
  );
  if (existingQueue) {
    return {
      updatedState: state,
      success: false,
      message: `Vehicle ${vehicle.licensePlate} is already queued at position #${existingQueue.queuePosition}.`,
    };
  }

  // Calculate next queue position for this terminal & route
  const currentQueued = state.fifoQueues.filter(
    (q) => q.terminalId === terminalId && q.targetRouteId === targetRouteId && q.status === 'QUEUED'
  );
  const nextPosition = currentQueued.length + 1;

  const newEntry: FIFOQueueEntry = {
    id: `fifo-${Date.now()}`,
    terminalId,
    associationId: vehicle.associationId,
    vehicleId,
    driverId,
    targetRouteId,
    checkInTime: new Date().toISOString(),
    queuePosition: nextPosition,
    status: 'QUEUED',
  };

  vehicle.status = 'IN_QUEUE';
  state.fifoQueues.push(newEntry);

  state.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: driver.phone,
    userName: driver.fullName,
    role: 'OPERATOR_DRIVER',
    action: 'FIFO_QUEUE_ENROLLED',
    details: `Vehicle ${vehicle.licensePlate} (Side #${vehicle.sideNumber}) checked into yard. Placed in FIFO Queue at position #${nextPosition} for Route ${targetRouteId}.`,
  });

  saveState(state);

  return {
    updatedState: { ...state },
    success: true,
    message: `Vehicle ${vehicle.licensePlate} registered at FIFO Queue position #${nextPosition}.`,
    entry: newEntry,
  };
}

/**
 * Assigns the head-of-line (top ranked) FIFO vehicle to an upcoming departure rotation slot.
 * PRD Reference: FR-FLM-03, UC-10, 4.7.2.1 Stage 2, SD-09
 */
export function assignFIFORotation(
  state: AppState,
  routeId: string,
  departureTimeISO: string,
  managerName: string,
  overrideVehicleId?: string,
  overrideReason?: string
): { updatedState: AppState; success: boolean; message: string; trip?: ScheduledTrip } {
  const route = state.routes.find((r) => r.id === routeId);
  if (!route) {
    return { updatedState: state, success: false, message: 'Route definition not found.' };
  }

  // Find eligible queued vehicles for this route
  const activeQueues = state.fifoQueues
    .filter((q) => q.targetRouteId === routeId && q.status === 'QUEUED')
    .sort((a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime());

  if (activeQueues.length === 0) {
    return {
      updatedState: state,
      success: false,
      message: 'Assignment Failed: No available vehicles found in terminal FIFO queue for this route.',
    };
  }

  let selectedQueueEntry: FIFOQueueEntry;

  if (overrideVehicleId) {
    // Out-of-Sequence Queue Override (UC-10 Alt Flow 1)
    const match = activeQueues.find((q) => q.vehicleId === overrideVehicleId);
    if (!match) {
      return {
        updatedState: state,
        success: false,
        message: 'Override vehicle is not currently checked in the terminal queue.',
      };
    }
    if (!overrideReason || overrideReason.trim().length === 0) {
      return {
        updatedState: state,
        success: false,
        message: 'Queue override rejected: Mandatory Operational Justification Reason is required.',
      };
    }
    selectedQueueEntry = match;
    selectedQueueEntry.status = 'OVERRIDDEN';
    selectedQueueEntry.overrideReason = overrideReason;

    state.auditLogs.unshift({
      id: `log-${Date.now()}-override`,
      timestamp: new Date().toISOString(),
      userId: 'MANAGER',
      userName: managerName,
      role: 'ASSOCIATE_MANAGER',
      action: 'FIFO_QUEUE_OVERRIDE',
      details: `WARNING: Strict FIFO sequence bypassed for Vehicle ${overrideVehicleId}. Justification: "${overrideReason}".`,
    });
  } else {
    // Normal First-In, First-Out pick (Top-of-Line)
    selectedQueueEntry = activeQueues[0];
    selectedQueueEntry.status = 'ASSIGNED';
  }

  const assignedVehicle = state.vehicles.find((v) => v.id === selectedQueueEntry.vehicleId);
  if (!assignedVehicle) {
    return { updatedState: state, success: false, message: 'Assigned vehicle record missing.' };
  }

  const fareCalc = calculateFare(
    route.distanceKm,
    state.globalTariffRatePerKm,
    assignedVehicle.level
  );

  const tripId = `trip-${Date.now()}`;
  const newTrip: ScheduledTrip = {
    id: tripId,
    routeId,
    vehicleId: assignedVehicle.id,
    driverId: selectedQueueEntry.driverId,
    departureTime: departureTimeISO,
    status: 'PUBLISHED',
    distanceKm: route.distanceKm,
    baseRatePerKm: state.globalTariffRatePerKm,
    levelModifier: VEHICLE_CONFIGS[assignedVehicle.level].modifier,
    terminalFee: 10.0,
    totalFare: fareCalc.totalFare,
    manifestLocked: false,
  };

  assignedVehicle.status = 'DISPATCHED';

  // Instantiate clean seating grid for assigned vehicle capacity
  const initialSeats = [];
  for (let i = 1; i <= assignedVehicle.totalCapacity; i++) {
    initialSeats.push({
      seatNumber: i,
      coordinate: `S-${i}`,
      state: 'AVAILABLE' as const,
    });
  }
  state.seatInventories[tripId] = initialSeats;
  state.trips.unshift(newTrip);

  // Recalculate remaining FIFO queue positions
  const remainingQueues = state.fifoQueues
    .filter((q) => q.targetRouteId === routeId && q.status === 'QUEUED')
    .sort((a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime());

  remainingQueues.forEach((q, idx) => {
    q.queuePosition = idx + 1;
  });

  state.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'DISPATCHER',
    userName: managerName,
    role: 'ASSOCIATE_MANAGER',
    action: 'ROTATION_ASSIGNED',
    details: `Vehicle ${assignedVehicle.licensePlate} assigned to Route ${routeId} departing at ${departureTimeISO}. Trip published live with calculated fare ${fareCalc.totalFare} ETB.`,
  });

  saveState(state);

  return {
    updatedState: { ...state },
    success: true,
    message: `Vehicle ${assignedVehicle.licensePlate} successfully assigned to route. Trip is now live for bookings.`,
    trip: newTrip,
  };
}

/**
 * Emergency Fleet Breakdown & Standby Substitution
 * PRD Reference: FR-FLM-02, UC-22, SD-13
 */
export function handleVehicleBreakdownSubstitution(
  state: AppState,
  tripId: string,
  replacementVehicleId: string,
  managerName: string
): { updatedState: AppState; success: boolean; message: string } {
  const trip = state.trips.find((t) => t.id === tripId);
  if (!trip) {
    return { updatedState: state, success: false, message: 'Scheduled trip not found.' };
  }

  const brokenVehicle = state.vehicles.find((v) => v.id === trip.vehicleId);
  const replacementVehicle = state.vehicles.find((v) => v.id === replacementVehicleId);

  if (!brokenVehicle || !replacementVehicle) {
    return { updatedState: state, success: false, message: 'Vehicle details invalid.' };
  }

  // Capacity Downgrade Constraint Violation (UC-22 Alt Flow 1)
  if (replacementVehicle.totalCapacity < brokenVehicle.totalCapacity) {
    return {
      updatedState: state,
      success: false,
      message: `Substitution Blocked: Standby vehicle capacity (${replacementVehicle.totalCapacity} seats) is insufficient to accommodate existing manifest (${brokenVehicle.totalCapacity} seats).`,
    };
  }

  // Flag broken vehicle as MAINTENANCE
  brokenVehicle.status = 'MAINTENANCE';

  // Mark replacement vehicle as active on trip
  replacementVehicle.status = 'DISPATCHED';
  trip.vehicleId = replacementVehicle.id;

  // Remap passenger seat manifests seamlessly without lost coordinate indexes
  const oldSeats = state.seatInventories[tripId] || [];
  const newSeats = [];
  for (let i = 1; i <= replacementVehicle.totalCapacity; i++) {
    const existingOldSeat = oldSeats.find((s) => s.seatNumber === i);
    if (existingOldSeat) {
      newSeats.push({ ...existingOldSeat });
    } else {
      newSeats.push({
        seatNumber: i,
        coordinate: `S-${i}`,
        state: 'AVAILABLE' as const,
      });
    }
  }
  state.seatInventories[tripId] = newSeats;

  // Update trip fare if vehicle level changed
  const fareResult = calculateFare(trip.distanceKm, trip.baseRatePerKm, replacementVehicle.level);
  trip.levelModifier = VEHICLE_CONFIGS[replacementVehicle.level].modifier;
  trip.totalFare = fareResult.totalFare;

  state.auditLogs.unshift({
    id: `log-${Date.now()}-breakdown`,
    timestamp: new Date().toISOString(),
    userId: 'MANAGER',
    userName: managerName,
    role: 'ASSOCIATE_MANAGER',
    action: 'FLEET_SUBSTITUTION_COMPLETED',
    details: `EMERGENCY FLEET SWAP: Broken Vehicle ${brokenVehicle.licensePlate} replaced by Standby Vehicle ${replacementVehicle.licensePlate}. All active passenger seats preserved. SMS alert broadcast initiated.`,
  });

  saveState(state);

  return {
    updatedState: { ...state },
    success: true,
    message: `Fleet Substitution Completed: Vehicle ${replacementVehicle.licensePlate} has replaced ${brokenVehicle.licensePlate}. Manifest synchronized.`,
  };
}

/**
 * Checks Driver Passenger Manifest Visibility constraint
 * PRD Reference: FR-OPS-02, UC-07: Restricted until exactly 2 hours prior to scheduled departure.
 */
export function checkDriverManifestVisibility(
  departureTimeISO: string,
  nowEpoch: number = Date.now()
): { visible: boolean; remainingMinutes: number; departureTimeStr: string } {
  const departureEpoch = new Date(departureTimeISO).getTime();
  const diffMinutes = Math.floor((departureEpoch - nowEpoch) / (1000 * 60));

  // Manifest is visible if diffMinutes <= 120 (i.e. <= 2 hours before departure or during/after departure)
  const visible = diffMinutes <= 120;

  return {
    visible,
    remainingMinutes: Math.max(0, diffMinutes),
    departureTimeStr: new Date(departureTimeISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * Cascading Price Recalculation Engine
 * Sweeps all future un-departed trips and synchronizes fares according to ETA macro tariff adjustments.
 * PRD Reference: FR-FLM-04, UC-11, UC-12, SD-11
 */
export function updateGlobalTariffAndCascadePrices(
  state: AppState,
  newBaseRatePerKm: number,
  adminName: string
): { updatedState: AppState; tripsUpdated: number; message: string } {
  state.globalTariffRatePerKm = newBaseRatePerKm;

  let tripsUpdated = 0;
  const now = Date.now();

  state.trips.forEach((trip) => {
    const depTime = new Date(trip.departureTime).getTime();
    if (depTime >= now && trip.status !== 'DEPARTED' && trip.status !== 'COMPLETED') {
      const vehicle = state.vehicles.find((v) => v.id === trip.vehicleId);
      const level = vehicle?.level ?? 'LEVEL_2';
      const calc = calculateFare(trip.distanceKm, newBaseRatePerKm, level);

      trip.baseRatePerKm = newBaseRatePerKm;
      trip.totalFare = calc.totalFare;
      trip.terminalFee = calc.terminalFee;
      trip.levelModifier = calc.levelModifier;
      tripsUpdated++;
    }
  });

  state.auditLogs.unshift({
    id: `log-${Date.now()}-tariff`,
    timestamp: new Date().toISOString(),
    userId: 'ETA_ADMIN',
    userName: adminName,
    role: 'SYSTEM_ADMIN',
    action: 'CASCADING_PRICE_RECALCULATION',
    details: `ETA Baseline Tariff updated to ${newBaseRatePerKm} ETB/km. Recalculated ticket fares across ${tripsUpdated} upcoming national trip records.`,
  });

  saveState(state);

  return {
    updatedState: { ...state },
    tripsUpdated,
    message: `Global Tariff Rules Applied: ${tripsUpdated} future trip schedules recalculated at ${newBaseRatePerKm} ETB/km.`,
  };
}
