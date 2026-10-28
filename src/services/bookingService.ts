/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppState,
  PaymentMethod,
  TicketReservation,
  VehicleLevel,
} from '../types';
import { calculateFare, calculateCancellationRefund } from './tariffEngine';
import { saveState, TEN_MINUTES_MS } from '../store/transportStore';

export interface LockSeatResult {
  success: boolean;
  message: string;
  lockExpiresAt?: number;
  remainingSeconds?: number;
}

/**
 * Enforces strict transactional seat locking (10-minute hold) and the single-ticket reservation rule.
 * PRD Reference: FR-TKM-02, FR-TKM-03, UC-14, UC-16
 */
export function lockSeat(
  state: AppState,
  tripId: string,
  seatNumber: number,
  passengerPhone: string,
  passengerName: string
): { updatedState: AppState; result: LockSeatResult } {
  const seats = state.seatInventories[tripId];
  if (!seats) {
    return {
      updatedState: state,
      result: { success: false, message: 'Invalid Trip ID.' },
    };
  }

  // Check Single-Ticket Constraint per Passenger Session (PRD Section 3.1 & 3.2.1 I)
  // If the user already has an active lock on this trip, clear the previous seat lock
  seats.forEach((s) => {
    if (s.lockedByPhone === passengerPhone && s.state === 'LOCKED') {
      s.state = 'AVAILABLE';
      delete s.lockedByPhone;
      delete s.lockedAt;
      delete s.lockExpiresAt;
    }
  });

  const targetSeat = seats.find((s) => s.seatNumber === seatNumber);
  if (!targetSeat) {
    return {
      updatedState: state,
      result: { success: false, message: `Seat ${seatNumber} does not exist on this vehicle layout.` },
    };
  }

  // Check if seat is currently available
  const now = Date.now();
  if (targetSeat.state === 'RESERVED' || targetSeat.state === 'CHECKED_IN') {
    return {
      updatedState: state,
      result: { success: false, message: `Seat ${seatNumber} is already booked and confirmed.` },
    };
  }

  if (targetSeat.state === 'LOCKED' && targetSeat.lockExpiresAt && targetSeat.lockExpiresAt > now) {
    return {
      updatedState: state,
      result: {
        success: false,
        message: `Seat ${seatNumber} is temporarily locked by another user checkout. Please choose another seat.`,
      },
    };
  }

  // Acquire 10-minute pessimistic hold lock
  const lockExpiresAt = now + TEN_MINUTES_MS;
  targetSeat.state = 'LOCKED';
  targetSeat.lockedByPhone = passengerPhone;
  targetSeat.passengerName = passengerName;
  targetSeat.lockedAt = now;
  targetSeat.lockExpiresAt = lockExpiresAt;

  // Add audit log
  state.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: passengerPhone,
    userName: passengerName,
    role: 'TRAVELER',
    action: 'SEAT_LOCK_ACQUIRED',
    details: `10-minute hold lock acquired on Trip ${tripId}, Seat ${seatNumber}. Expires in 600s.`,
  });

  saveState(state);

  return {
    updatedState: { ...state },
    result: {
      success: true,
      message: `Seat ${seatNumber} successfully locked for 10 minutes.`,
      lockExpiresAt,
      remainingSeconds: 600,
    },
  };
}

/**
 * Manually releases an active seat lock (e.g. if traveler cancels during checkout)
 */
export function unlockSeat(
  state: AppState,
  tripId: string,
  seatNumber: number,
  passengerPhone: string
): AppState {
  const seats = state.seatInventories[tripId];
  if (!seats) return state;

  const targetSeat = seats.find((s) => s.seatNumber === seatNumber);
  if (targetSeat && targetSeat.state === 'LOCKED' && targetSeat.lockedByPhone === passengerPhone) {
    targetSeat.state = 'AVAILABLE';
    delete targetSeat.lockedByPhone;
    delete targetSeat.passengerName;
    delete targetSeat.lockedAt;
    delete targetSeat.lockExpiresAt;

    state.auditLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: passengerPhone,
      userName: passengerPhone,
      role: 'TRAVELER',
      action: 'SEAT_LOCK_RELEASED',
      details: `Lock manually released for Trip ${tripId}, Seat ${seatNumber}.`,
    });

    saveState(state);
  }

  return { ...state };
}

/**
 * Finalizes checkout and creates an official Ticket Reservation with 5%/95% automated split
 * PRD Reference: FR-PYM-01, FR-PYM-02, FR-PYM-03, UC-18
 */
export function confirmTicketBooking(
  state: AppState,
  tripId: string,
  seatNumber: number,
  passengerName: string,
  passengerPhone: string,
  paymentMethod: PaymentMethod,
  isWalkIn: boolean = false
): { updatedState: AppState; ticket?: TicketReservation; error?: string } {
  const trip = state.trips.find((t) => t.id === tripId);
  if (!trip) {
    return { updatedState: state, error: 'Scheduled trip not found.' };
  }

  const seats = state.seatInventories[tripId];
  const targetSeat = seats?.find((s) => s.seatNumber === seatNumber);
  if (!targetSeat) {
    return { updatedState: state, error: 'Target seat not found.' };
  }

  // Validate lock state
  const now = Date.now();
  if (isWalkIn) {
    if (targetSeat.state !== 'AVAILABLE') {
      return {
        updatedState: state,
        error: 'This seat is no longer available. Please select another seat.',
      };
    }
  } else {
    if (targetSeat.state !== 'LOCKED' || targetSeat.lockedByPhone !== passengerPhone) {
      return {
        updatedState: state,
        error: 'Seat reservation window expired or not held by this phone number. Please re-select your seat.',
      };
    }
    if (!targetSeat.lockExpiresAt || targetSeat.lockExpiresAt <= now) {
      return {
        updatedState: state,
        error: 'Seat reservation window expired. Please re-select your seat.',
      };
    }
  }

  const vehicle = state.vehicles.find((v) => v.id === trip.vehicleId);
  const vehicleLevel = vehicle?.level ?? 'LEVEL_2';
  const fareResult = calculateFare(trip.distanceKm, trip.baseRatePerKm, vehicleLevel as VehicleLevel);

  // Generate unique ticket number and verification code
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const ticketNumber = `ET-WL-${randomSuffix}`;
  const verificationCode = `ET-VER-${Math.floor(100000 + Math.random() * 900000)}`;

  const newTicket: TicketReservation = {
    id: `tkt-${Date.now()}-${randomSuffix}`,
    ticketNumber,
    tripId,
    passengerName,
    passengerPhone,
    seatCoordinate: `S-${seatNumber}`,
    seatNumber,
    status: 'RESERVED',
    paymentMethod,
    paymentStatus: 'PAID',
    fareAmount: fareResult.totalFare,
    terminalFeeShare: fareResult.terminalShare, // 5%
    operatorShare: fareResult.operatorShare,   // 95%
    verificationCode,
    issuedAt: new Date().toISOString(),
    isWalkIn,
  };

  // Mutate seat to RESERVED
  targetSeat.state = 'RESERVED';
  targetSeat.passengerName = passengerName;
  targetSeat.ticketId = newTicket.id;
  delete targetSeat.lockedByPhone;
  delete targetSeat.lockedAt;
  delete targetSeat.lockExpiresAt;

  // Append ticket to state
  state.tickets.unshift(newTicket);

  // Check 80% capacity manifest auto-lock trigger (PRD Section 1.8.4 & 4.7.2.1 Stage 3)
  const bookedSeatsCount = seats.filter((s) => s.state === 'RESERVED' || s.state === 'CHECKED_IN').length;
  const totalSeatsCount = seats.length;
  const fillRatio = bookedSeatsCount / totalSeatsCount;

  if (fillRatio >= 0.80 && !trip.manifestLocked) {
    trip.manifestLocked = true;
    state.auditLogs.unshift({
      id: `log-${Date.now()}-manifest-lock`,
      timestamp: new Date().toISOString(),
      userId: 'SYSTEM',
      userName: 'Dispatch Automation Engine',
      role: 'SYSTEM_ADMIN',
      action: 'MANIFEST_AUTO_LOCKED',
      details: `Trip ${trip.id} reached ${Math.round(fillRatio * 100)}% capacity (>= 80% threshold). Passenger manifest automatically locked for departure.`,
    });
  }

  // Log successful booking & revenue split
  state.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: passengerPhone,
    userName: passengerName,
    role: isWalkIn ? 'TERMINAL_CLERK' : 'TRAVELER',
    action: isWalkIn ? 'WALK_IN_TICKET_ISSUED' : 'DIGITAL_TICKET_BOOKED',
    details: `Ticket ${ticketNumber} issued for ${passengerName} (${passengerPhone}). Seat S-${seatNumber}. Fare: ${fareResult.totalFare} ETB (5% Terminal: ${fareResult.terminalShare} ETB, 95% Operator: ${fareResult.operatorShare} ETB). Channel: ${paymentMethod}.`,
  });

  saveState(state);

  return {
    updatedState: { ...state },
    ticket: newTicket,
  };
}

/**
 * Handles time-bounded ticket cancellation and automated refund
 * PRD Reference: FR-PYM-05, UC-21
 */
export function cancelTicketReservation(
  state: AppState,
  ticketId: string,
  callerRole: string
): { updatedState: AppState; success: boolean; message: string; refundAmount?: number } {
  const ticket = state.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return { updatedState: state, success: false, message: 'Ticket record not found.' };
  }

  if (ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED') {
    return { updatedState: state, success: false, message: 'Ticket has already been cancelled.' };
  }

  if (ticket.status === 'CHECKED_IN') {
    return { updatedState: state, success: false, message: 'Passenger has already checked-in and boarded.' };
  }

  const trip = state.trips.find((t) => t.id === ticket.tripId);
  if (!trip) {
    return { updatedState: state, success: false, message: 'Associated trip block not found.' };
  }

  // Calculate refund eligibility (30-minute threshold)
  const refundEval = calculateCancellationRefund(ticket.fareAmount, trip.departureTime);
  if (!refundEval.eligible) {
    return {
      updatedState: state,
      success: false,
      message: refundEval.reason || 'Cancellation denied: Inside the final 30-minute departure window.',
    };
  }

  // Mark ticket as cancelled & refund amount
  ticket.status = 'CANCELLED';
  ticket.cancelledAt = new Date().toISOString();
  ticket.refundAmount = refundEval.refundAmount;
  ticket.paymentStatus = 'REFUNDED';

  // Release seat coordinate back to AVAILABLE
  const seats = state.seatInventories[ticket.tripId];
  const targetSeat = seats?.find((s) => s.seatNumber === ticket.seatNumber);
  if (targetSeat) {
    targetSeat.state = 'AVAILABLE';
    delete targetSeat.passengerName;
    delete targetSeat.ticketId;
    delete targetSeat.lockedByPhone;
  }

  // If manifest was locked due to 80% threshold, check if it drops below
  const bookedCount = seats ? seats.filter((s) => s.state === 'RESERVED' || s.state === 'CHECKED_IN').length : 0;
  const totalCount = seats ? seats.length : 1;
  if (bookedCount / totalCount < 0.80) {
    trip.manifestLocked = false;
  }

  state.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: ticket.passengerPhone,
    userName: ticket.passengerName,
    role: callerRole as any,
    action: 'TICKET_CANCELLED',
    details: `Ticket ${ticket.ticketNumber} cancelled. Original Fare: ${ticket.fareAmount} ETB. Penalty (10%): ${refundEval.penaltyAmount} ETB. Net Refund: ${refundEval.refundAmount} ETB credited to ${ticket.paymentMethod}. Seat S-${ticket.seatNumber} restored to inventory.`,
  });

  saveState(state);

  return {
    updatedState: { ...state },
    success: true,
    message: `Ticket ${ticket.ticketNumber} cancelled. Refund of ${refundEval.refundAmount} ETB processed.`,
    refundAmount: refundEval.refundAmount,
  };
}

/**
 * Gate Check-In & Boarding Verification via encrypted QR code
 * PRD Reference: FR-OPS-01, UC-19
 */
export function checkInPassengerByCode(
  state: AppState,
  verificationCode: string,
  clerkName: string
): { updatedState: AppState; success: boolean; message: string; ticket?: TicketReservation } {
  const cleanCode = verificationCode.trim().toUpperCase();
  const ticket = state.tickets.find(
    (t) => t.verificationCode.toUpperCase() === cleanCode || t.ticketNumber.toUpperCase() === cleanCode
  );

  if (!ticket) {
    return {
      updatedState: state,
      success: false,
      message: 'Access Denied: Ticket verification code not found in central database.',
    };
  }

  if (ticket.status === 'CHECKED_IN') {
    return {
      updatedState: state,
      success: false,
      message: `Warning: Ticket ${ticket.ticketNumber} was already checked-in at ${ticket.checkedInAt ? new Date(ticket.checkedInAt).toLocaleTimeString() : 'earlier'}. Duplicate boarding forbidden.`,
      ticket,
    };
  }

  if (ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED') {
    return {
      updatedState: state,
      success: false,
      message: `Access Denied: Ticket ${ticket.ticketNumber} was cancelled and refunded.`,
      ticket,
    };
  }

  // Update ticket to CHECKED_IN
  ticket.status = 'CHECKED_IN';
  ticket.checkedInAt = new Date().toISOString();

  // Update seat inventory
  const seats = state.seatInventories[ticket.tripId];
  const targetSeat = seats?.find((s) => s.seatNumber === ticket.seatNumber);
  if (targetSeat) {
    targetSeat.state = 'CHECKED_IN';
  }

  state.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'CLERK',
    userName: clerkName,
    role: 'TERMINAL_CLERK',
    action: 'PASSENGER_BOARDING_APPROVED',
    details: `Passenger ${ticket.passengerName} verified via Code ${cleanCode}. Cleared to board Seat S-${ticket.seatNumber} on Trip ${ticket.tripId}.`,
  });

  saveState(state);

  return {
    updatedState: { ...state },
    success: true,
    message: `Access Approved: Clear to Board. Passenger: ${ticket.passengerName}, Seat: S-${ticket.seatNumber}`,
    ticket,
  };
}
