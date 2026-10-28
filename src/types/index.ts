/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 
  | 'TRAVELER' 
  | 'TERMINAL_CLERK' 
  | 'OPERATOR_DRIVER' 
  | 'ASSOCIATE_MANAGER' 
  | 'SYSTEM_ADMIN';

export interface User {
  id: string;
  name: string;
  phone: string; // Unique identifier across all roles
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED';
  associationId?: string; // For Associate Managers and Drivers
  assignedVehicleId?: string; // For Drivers
  createdAt: string;
}

export interface TransportAssociation {
  id: string;
  name: string;
  licenseNumber: string;
  regionalOfficeHub: string;
  liaisonPhone: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export type VehicleLevel = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';

export interface Vehicle {
  id: string;
  licensePlate: string;
  sideNumber: string;
  level: VehicleLevel;
  totalCapacity: number; // 45 for Level 1, 60 for Level 2 & 3
  associationId: string;
  assignedDriverId?: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'IN_QUEUE' | 'DISPATCHED';
}

export interface Driver {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  associationId: string;
  dutyStatus: 'ACTIVE' | 'OFF_DUTY' | 'SUSPENDED';
}

export interface TerminalStation {
  id: string;
  name: string;
  nameAmharic: string;
  region: string;
  bayCapacity: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Route {
  id: string;
  originTerminalId: string;
  destinationTerminalId: string;
  distanceKm: number;
  stops: string[];
  baseRatePerKm: number; // Configured globally by ETA Regulator
}

export type TripStatus = 'DRAFT' | 'PUBLISHED' | 'BOARDING' | 'DELAYED' | 'DEPARTED' | 'ABORTED' | 'COMPLETED';

export interface ScheduledTrip {
  id: string;
  routeId: string;
  vehicleId: string;
  driverId: string;
  departureTime: string; // ISO 8601
  status: TripStatus;
  distanceKm: number;
  baseRatePerKm: number;
  levelModifier: number; // 1.30 for Level 1, 1.15 for Level 2, 1.00 for Level 3
  terminalFee: number; // Fixed 10.00 ETB
  totalFare: number; // ((distanceKm * baseRatePerKm) * levelModifier) + terminalFee
  manifestLocked: boolean; // Triggered automatically when bookings >= 80% capacity
}

export type SeatState = 'AVAILABLE' | 'LOCKED' | 'RESERVED' | 'CHECKED_IN';

export interface SeatInventoryItem {
  seatNumber: number;
  coordinate: string; // e.g. "S-1", "S-2", ...
  state: SeatState;
  lockedByPhone?: string;
  lockedAt?: number; // epoch ms
  lockExpiresAt?: number; // epoch ms (10 min after lockedAt)
  ticketId?: string;
  passengerName?: string;
}

export type PaymentMethod = 'TELEBIRR' | 'CBE_BIRR' | 'CHAPA' | 'CASH_POS';

export type TicketStatus = 'RESERVED' | 'CHECKED_IN' | 'CANCELLED' | 'REFUNDED';

export interface TicketReservation {
  id: string;
  ticketNumber: string; // e.g., "ET-WL-98234"
  tripId: string;
  passengerName: string;
  passengerPhone: string;
  seatCoordinate: string;
  seatNumber: number;
  status: TicketStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
  fareAmount: number;
  terminalFeeShare: number; // Exactly 5% of fareAmount
  operatorShare: number; // Exactly 95% of fareAmount
  verificationCode: string; // Scannable crypto/alphanumeric hash
  issuedAt: string;
  cancelledAt?: string;
  refundAmount?: number;
  checkedInAt?: string;
  isWalkIn: boolean;
}

export interface FIFOQueueEntry {
  id: string;
  terminalId: string;
  associationId: string;
  vehicleId: string;
  driverId: string;
  targetRouteId: string;
  checkInTime: string;
  queuePosition: number;
  status: 'QUEUED' | 'ASSIGNED' | 'DEPARTED' | 'OVERRIDDEN';
  overrideReason?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: UserRole;
  action: string;
  details: string;
}

export interface FinancialSummary {
  totalGrossRevenue: number;
  totalTerminalFees: number; // 5%
  totalOperatorDisbursements: number; // 95%
  totalTicketsSold: number;
  totalCancellations: number;
}

export interface AppState {
  users: User[];
  associations: TransportAssociation[];
  terminals: TerminalStation[];
  vehicles: Vehicle[];
  drivers: Driver[];
  routes: Route[];
  trips: ScheduledTrip[];
  seatInventories: Record<string, SeatInventoryItem[]>; // Key: tripId
  tickets: TicketReservation[];
  fifoQueues: FIFOQueueEntry[];
  auditLogs: AuditLog[];
  globalTariffRatePerKm: number;
}
