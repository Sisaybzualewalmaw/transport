/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppState,
  AuditLog,
  Driver,
  FIFOQueueEntry,
  FinancialSummary,
  PaymentMethod,
  Route,
  ScheduledTrip,
  SeatInventoryItem,
  TerminalStation,
  TicketReservation,
  TransportAssociation,
  User,
  UserRole,
  Vehicle,
} from '../types';
import { calculateFare, calculateCancellationRefund, VEHICLE_CONFIGS } from '../services/tariffEngine';

const STORAGE_KEY = 'et_trans_woldia_data_v1';

// Initial Seed Data based on Woldia University Senior Project Document
const INITIAL_TERMINALS: TerminalStation[] = [
  {
    id: 'term-woldia',
    name: 'Woldia Menehariya Terminal',
    nameAmharic: 'የወልዲያ መነሀሪያ',
    region: 'North Wollo / Semen Wolo',
    bayCapacity: 45,
    status: 'ACTIVE',
  },
  {
    id: 'term-addis',
    name: 'Addis Ababa (Lamberet Terminal)',
    nameAmharic: 'አዲስ አበባ (ላምበረት)',
    region: 'Addis Ababa',
    bayCapacity: 120,
    status: 'ACTIVE',
  },
  {
    id: 'term-dessie',
    name: 'Dessie Terminal',
    nameAmharic: 'የደሴ መነሀሪያ',
    region: 'South Wollo',
    bayCapacity: 60,
    status: 'ACTIVE',
  },
  {
    id: 'term-bahirdar',
    name: 'Bahir Dar Terminal',
    nameAmharic: 'የባሕር ዳር መነሀሪያ',
    region: 'Amhara',
    bayCapacity: 80,
    status: 'ACTIVE',
  },
  {
    id: 'term-mekelle',
    name: 'Mekelle Terminal',
    nameAmharic: 'የመቐለ መነሀሪያ',
    region: 'Tigray',
    bayCapacity: 50,
    status: 'ACTIVE',
  },
];

const INITIAL_ASSOCIATIONS: TransportAssociation[] = [
  {
    id: 'assoc-semen-wolo',
    name: 'Semen Wolo Transport Logistics Association',
    licenseNumber: 'ETA-LIC-001/18-842',
    regionalOfficeHub: 'Woldia Central Terminal Hub',
    liaisonPhone: '0333312843',
    status: 'ACTIVE',
    createdAt: '2024-01-10T08:00:00Z',
  },
  {
    id: 'assoc-walia',
    name: 'Walia Inter-Regional Transit Operator',
    licenseNumber: 'ETA-LIC-044/19-201',
    regionalOfficeHub: 'Addis Ababa Lamberet Depot',
    liaisonPhone: '0111223344',
    status: 'ACTIVE',
    createdAt: '2024-02-15T09:00:00Z',
  },
];

const INITIAL_DRIVERS: Driver[] = [
  {
    id: 'drv-1',
    userId: 'usr-drv-1',
    fullName: 'Haile Kebede',
    phone: '0911223344',
    licenseNumber: 'ETH-DRV-8910',
    associationId: 'assoc-semen-wolo',
    dutyStatus: 'ACTIVE',
  },
  {
    id: 'drv-2',
    userId: 'usr-drv-2',
    fullName: 'Tesfaye Desta',
    phone: '0922334455',
    licenseNumber: 'ETH-DRV-8911',
    associationId: 'assoc-semen-wolo',
    dutyStatus: 'ACTIVE',
  },
  {
    id: 'drv-3',
    userId: 'usr-drv-3',
    fullName: 'Abebe Bikila',
    phone: '0933445566',
    licenseNumber: 'ETH-DRV-8912',
    associationId: 'assoc-walia',
    dutyStatus: 'ACTIVE',
  },
  {
    id: 'drv-4',
    userId: 'usr-drv-4',
    fullName: 'Mulugeta Assefa',
    phone: '0944556677',
    licenseNumber: 'ETH-DRV-8913',
    associationId: 'assoc-semen-wolo',
    dutyStatus: 'ACTIVE',
  },
];

const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'veh-1',
    licensePlate: '3-90038 AA', // Featured in real Woldia project documentation receipt
    sideNumber: '412',
    level: 'LEVEL_2',
    totalCapacity: 60,
    associationId: 'assoc-semen-wolo',
    assignedDriverId: 'drv-1',
    status: 'ACTIVE',
  },
  {
    id: 'veh-2',
    licensePlate: '3-88214 AM',
    sideNumber: '108',
    level: 'LEVEL_1',
    totalCapacity: 45,
    associationId: 'assoc-semen-wolo',
    assignedDriverId: 'drv-2',
    status: 'ACTIVE',
  },
  {
    id: 'veh-3',
    licensePlate: '3-77192 ET',
    sideNumber: '205',
    level: 'LEVEL_3',
    totalCapacity: 60,
    associationId: 'assoc-walia',
    assignedDriverId: 'drv-3',
    status: 'ACTIVE',
  },
  {
    id: 'veh-standby',
    licensePlate: '3-65432 AA',
    sideNumber: '999',
    level: 'LEVEL_2',
    totalCapacity: 60,
    associationId: 'assoc-semen-wolo',
    assignedDriverId: 'drv-4',
    status: 'ACTIVE', // Available in yard for emergency breakdown substitution!
  },
];

export const INITIAL_BASE_RATE_PER_KM = 0.85; // Official ETA Baseline Tariff Rate per KM

const INITIAL_ROUTES: Route[] = [
  {
    id: 'rt-woldia-addis',
    originTerminalId: 'term-woldia',
    destinationTerminalId: 'term-addis',
    distanceKm: 521,
    stops: ['Dessie', 'Kombolcha', 'Debre Sina', 'Debre Birhan'],
    baseRatePerKm: INITIAL_BASE_RATE_PER_KM,
  },
  {
    id: 'rt-woldia-bahirdar',
    originTerminalId: 'term-woldia',
    destinationTerminalId: 'term-bahirdar',
    distanceKm: 299,
    stops: ['Gashena', 'Nefas Mewcha', 'Debre Tabor'],
    baseRatePerKm: INITIAL_BASE_RATE_PER_KM,
  },
  {
    id: 'rt-woldia-mekelle',
    originTerminalId: 'term-woldia',
    destinationTerminalId: 'term-mekelle',
    distanceKm: 252,
    stops: ['Kobo', 'Alamata', 'Maichew'],
    baseRatePerKm: INITIAL_BASE_RATE_PER_KM,
  },
  {
    id: 'rt-dessie-addis',
    originTerminalId: 'term-dessie',
    destinationTerminalId: 'term-addis',
    distanceKm: 400,
    stops: ['Debre Sina', 'Debre Birhan'],
    baseRatePerKm: INITIAL_BASE_RATE_PER_KM,
  },
];

function generateInitialSeats(capacity: number): SeatInventoryItem[] {
  const seats: SeatInventoryItem[] = [];
  for (let i = 1; i <= capacity; i++) {
    seats.push({
      seatNumber: i,
      coordinate: `S-${i}`,
      state: 'AVAILABLE',
    });
  }
  return seats;
}

export function createInitialState(): AppState {
  // Set departure times relative to current local time
  const now = new Date();
  
  // Trip 1: Departing in 1 hour 45 minutes (Within 2-hour window -> manifest unlocked for driver!)
  const trip1Time = new Date(now.getTime() + 105 * 60 * 1000).toISOString();
  
  // Trip 2: Departing tomorrow morning at 06:30 AM
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 30, 0, 0);
  const trip2Time = tomorrow.toISOString();

  // Trip 3: Departing tomorrow afternoon at 13:00
  tomorrow.setHours(13, 0, 0, 0);
  const trip3Time = tomorrow.toISOString();

  const fare1 = calculateFare(521, INITIAL_BASE_RATE_PER_KM, 'LEVEL_2');
  const fare2 = calculateFare(299, INITIAL_BASE_RATE_PER_KM, 'LEVEL_1');
  const fare3 = calculateFare(252, INITIAL_BASE_RATE_PER_KM, 'LEVEL_3');

  const trips: ScheduledTrip[] = [
    {
      id: 'trip-101',
      routeId: 'rt-woldia-addis',
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      departureTime: trip1Time,
      status: 'BOARDING',
      distanceKm: 521,
      baseRatePerKm: INITIAL_BASE_RATE_PER_KM,
      levelModifier: VEHICLE_CONFIGS.LEVEL_2.modifier,
      terminalFee: 10.0,
      totalFare: fare1.totalFare,
      manifestLocked: false,
    },
    {
      id: 'trip-102',
      routeId: 'rt-woldia-bahirdar',
      vehicleId: 'veh-2',
      driverId: 'drv-2',
      departureTime: trip2Time,
      status: 'PUBLISHED',
      distanceKm: 299,
      baseRatePerKm: INITIAL_BASE_RATE_PER_KM,
      levelModifier: VEHICLE_CONFIGS.LEVEL_1.modifier,
      terminalFee: 10.0,
      totalFare: fare2.totalFare,
      manifestLocked: false,
    },
    {
      id: 'trip-103',
      routeId: 'rt-woldia-mekelle',
      vehicleId: 'veh-3',
      driverId: 'drv-3',
      departureTime: trip3Time,
      status: 'PUBLISHED',
      distanceKm: 252,
      baseRatePerKm: INITIAL_BASE_RATE_PER_KM,
      levelModifier: VEHICLE_CONFIGS.LEVEL_3.modifier,
      terminalFee: 10.0,
      totalFare: fare3.totalFare,
      manifestLocked: false,
    },
  ];

  const seatInventories: Record<string, SeatInventoryItem[]> = {
    'trip-101': generateInitialSeats(60),
    'trip-102': generateInitialSeats(45),
    'trip-103': generateInitialSeats(60),
  };

  // Seed sample pre-booked seats on trip-101 to demonstrate boarding & manifest
  const tickets: TicketReservation[] = [
    {
      id: 'tkt-001',
      ticketNumber: 'ET-WL-31050', // Matching realistic Ethiopian ticket stub ID from appendix
      tripId: 'trip-101',
      passengerName: 'Sisay Bizualew',
      passengerPhone: '0911554433',
      seatCoordinate: 'S-12',
      seatNumber: 12,
      status: 'RESERVED',
      paymentMethod: 'TELEBIRR',
      paymentStatus: 'PAID',
      fareAmount: fare1.totalFare,
      terminalFeeShare: fare1.terminalShare,
      operatorShare: fare1.operatorShare,
      verificationCode: 'ET-VER-778812',
      issuedAt: new Date(now.getTime() - 3600000).toISOString(),
      isWalkIn: false,
    },
    {
      id: 'tkt-002',
      ticketNumber: 'ET-WL-31051',
      tripId: 'trip-101',
      passengerName: 'Selam Debas',
      passengerPhone: '0922665544',
      seatCoordinate: 'S-14',
      seatNumber: 14,
      status: 'CHECKED_IN',
      paymentMethod: 'CBE_BIRR',
      paymentStatus: 'PAID',
      fareAmount: fare1.totalFare,
      terminalFeeShare: fare1.terminalShare,
      operatorShare: fare1.operatorShare,
      verificationCode: 'ET-VER-992214',
      issuedAt: new Date(now.getTime() - 7200000).toISOString(),
      checkedInAt: new Date(now.getTime() - 1800000).toISOString(),
      isWalkIn: false,
    },
    {
      id: 'tkt-003',
      ticketNumber: 'ET-WL-31052',
      tripId: 'trip-101',
      passengerName: 'Belete Siyum (Walk-in)',
      passengerPhone: '0933776655',
      seatCoordinate: 'S-1',
      seatNumber: 1,
      status: 'RESERVED',
      paymentMethod: 'CASH_POS',
      paymentStatus: 'PAID',
      fareAmount: fare1.totalFare,
      terminalFeeShare: fare1.terminalShare,
      operatorShare: fare1.operatorShare,
      verificationCode: 'ET-VER-112201',
      issuedAt: new Date(now.getTime() - 1200000).toISOString(),
      isWalkIn: true,
    },
  ];

  // Reflect seeded tickets on trip-101 seat inventory
  seatInventories['trip-101'][11].state = 'RESERVED';
  seatInventories['trip-101'][11].passengerName = 'Sisay Bizualew';
  seatInventories['trip-101'][11].ticketId = 'tkt-001';

  seatInventories['trip-101'][13].state = 'CHECKED_IN';
  seatInventories['trip-101'][13].passengerName = 'Selam Debas';
  seatInventories['trip-101'][13].ticketId = 'tkt-002';

  seatInventories['trip-101'][0].state = 'RESERVED';
  seatInventories['trip-101'][0].passengerName = 'Belete Siyum (Walk-in)';
  seatInventories['trip-101'][0].ticketId = 'tkt-003';

  const fifoQueues: FIFOQueueEntry[] = [
    {
      id: 'fifo-1',
      terminalId: 'term-woldia',
      associationId: 'assoc-semen-wolo',
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      targetRouteId: 'rt-woldia-addis',
      checkInTime: new Date(now.getTime() - 14400000).toISOString(),
      queuePosition: 1,
      status: 'ASSIGNED',
    },
    {
      id: 'fifo-2',
      terminalId: 'term-woldia',
      associationId: 'assoc-semen-wolo',
      vehicleId: 'veh-standby',
      driverId: 'drv-4',
      targetRouteId: 'rt-woldia-addis',
      checkInTime: new Date(now.getTime() - 7200000).toISOString(),
      queuePosition: 2,
      status: 'QUEUED',
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'log-1',
      timestamp: new Date().toISOString(),
      userId: 'usr-admin-1',
      userName: 'ETA System Regulator',
      role: 'SYSTEM_ADMIN',
      action: 'SYSTEM_INITIALIZATION',
      details: 'Woldia Menehariya Transport Scheduling and Ticketing core online. Base tariff: 0.85 ETB/km.',
    },
  ];

  const users: User[] = [
    {
      id: 'usr-traveler-1',
      name: 'Belete Siyum',
      phone: '0912345678',
      role: 'TRAVELER',
      status: 'ACTIVE',
      createdAt: '2025-01-15T10:00:00Z',
    },
    {
      id: 'usr-clerk-1',
      name: 'Abirham Temesgen (Woldia Gate Clerk)',
      phone: '0923456789',
      role: 'TERMINAL_CLERK',
      status: 'ACTIVE',
      createdAt: '2025-01-10T08:00:00Z',
    },
    {
      id: 'usr-drv-1',
      name: 'Haile Kebede (Driver - 3-90038 AA)',
      phone: '0911223344',
      role: 'OPERATOR_DRIVER',
      status: 'ACTIVE',
      associationId: 'assoc-semen-wolo',
      assignedVehicleId: 'veh-1',
      createdAt: '2025-01-05T08:00:00Z',
    },
    {
      id: 'usr-manager-1',
      name: 'Natnael Argaw (Semen Wolo Manager)',
      phone: '0934567890',
      role: 'ASSOCIATE_MANAGER',
      status: 'ACTIVE',
      associationId: 'assoc-semen-wolo',
      createdAt: '2025-01-01T08:00:00Z',
    },
    {
      id: 'usr-admin-1',
      name: 'Zeleke C. (ETA Chief Regulator)',
      phone: '0945678901',
      role: 'SYSTEM_ADMIN',
      status: 'ACTIVE',
      createdAt: '2025-01-01T08:00:00Z',
    },
  ];

  return {
    users,
    associations: INITIAL_ASSOCIATIONS,
    terminals: INITIAL_TERMINALS,
    vehicles: INITIAL_VEHICLES,
    drivers: INITIAL_DRIVERS,
    routes: INITIAL_ROUTES,
    trips,
    seatInventories,
    tickets,
    fifoQueues,
    auditLogs,
    globalTariffRatePerKm: INITIAL_BASE_RATE_PER_KM,
  };
}

export function loadStoredState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Run auto cleanup on expired locks on load
      cleanupExpiredLocksInState(parsed);
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse stored state, falling back to initial seed data', e);
  }
  const init = createInitialState();
  saveState(init);
  return init;
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to write state to localStorage', e);
  }
}

// Seat lock window is exactly 10 minutes (600,000 ms) as specified in PRD Section 3.2.3 III & UC-16
export const TEN_MINUTES_MS = 10 * 60 * 1000;

export function cleanupExpiredLocksInState(state: AppState): boolean {
  let changed = false;
  const now = Date.now();
  Object.keys(state.seatInventories).forEach((tripId) => {
    const list = state.seatInventories[tripId];
    list.forEach((seat) => {
      if (seat.state === 'LOCKED' && seat.lockExpiresAt && seat.lockExpiresAt <= now) {
        seat.state = 'AVAILABLE';
        delete seat.lockedByPhone;
        delete seat.lockedAt;
        delete seat.lockExpiresAt;
        changed = true;
      }
    });
  });
  return changed;
}

export function computeFinancialSummary(state: AppState): FinancialSummary {
  const paidTickets = state.tickets.filter((t) => t.paymentStatus === 'PAID');
  const cancelledTickets = state.tickets.filter((t) => t.status === 'CANCELLED');

  const totalGrossRevenue = paidTickets.reduce((acc, t) => acc + t.fareAmount, 0);
  const totalTerminalFees = paidTickets.reduce((acc, t) => acc + t.terminalFeeShare, 0);
  const totalOperatorDisbursements = paidTickets.reduce((acc, t) => acc + t.operatorShare, 0);

  return {
    totalGrossRevenue: Number(totalGrossRevenue.toFixed(2)),
    totalTerminalFees: Number(totalTerminalFees.toFixed(2)),
    totalOperatorDisbursements: Number(totalOperatorDisbursements.toFixed(2)),
    totalTicketsSold: paidTickets.length,
    totalCancellations: cancelledTickets.length,
  };
}
