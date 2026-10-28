/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  AppState,
  ScheduledTrip,
  SeatInventoryItem,
  TicketReservation,
  User,
  VehicleLevel,
  PaymentMethod,
} from '../types';
import { Locale, TRANSLATIONS } from '../utils/translations';
import { formatDualDate } from '../utils/ethiopianCalendar';
import { VEHICLE_CONFIGS } from '../services/tariffEngine';
import { lockSeat, unlockSeat, confirmTicketBooking, cancelTicketReservation } from '../services/bookingService';
import { BoardingPassModal } from './BoardingPassModal';
import {
  Search,
  Bus,
  Clock,
  CheckCircle,
  AlertTriangle,
  QrCode,
  CreditCard,
  XCircle,
  Lock,
  ChevronRight,
  Shield,
  Ticket,
} from 'lucide-react';

interface TravelerPortalProps {
  currentUser: User;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  locale: Locale;
}

export const TravelerPortal: React.FC<TravelerPortalProps> = ({
  currentUser,
  state,
  setState,
  locale,
}) => {
  const t = TRANSLATIONS[locale];

  // Active view: Search & Book or My Trips
  const [activeTab, setActiveTab] = useState<'search' | 'myTrips'>('search');

  // Search Filters
  const [originId, setOriginId] = useState<string>('term-woldia');
  const [destinationId, setDestinationId] = useState<string>('term-addis');
  const [selectedLevel, setSelectedLevel] = useState<VehicleLevel | 'ALL'>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Selected Trip & Seat Selection
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<number | null>(null);

  // 10-Minute Lock Countdown State
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TELEBIRR');
  const [passengerName, setPassengerName] = useState<string>(currentUser.name);
  const [passengerPhone, setPassengerPhone] = useState<string>(currentUser.phone);
  const [pinPrompt, setPinPrompt] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Active Boarding Pass Preview Modal
  const [activeBoardingPass, setActiveBoardingPass] = useState<TicketReservation | null>(null);

  // Interval timer for 10-minute hold lock
  useEffect(() => {
    if (!lockExpiresAt) {
      setCountdownSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((lockExpiresAt - Date.now()) / 1000));
      setCountdownSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setLockExpiresAt(null);
        setSelectedSeatNumber(null);
        setShowCheckoutModal(false);
        setActionMessage({
          type: 'error',
          text: 'Booking window expired: 10-minute reservation hold has lapsed. The seat was released.',
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockExpiresAt]);

  // Query matching trips
  const matchingTrips = state.trips.filter((trip) => {
    const route = state.routes.find((r) => r.id === trip.routeId);
    if (!route) return false;

    const matchesOrigin = !originId || route.originTerminalId === originId;
    const matchesDestination = !destinationId || route.destinationTerminalId === destinationId;

    const vehicle = state.vehicles.find((v) => v.id === trip.vehicleId);
    const matchesLevel = selectedLevel === 'ALL' || vehicle?.level === selectedLevel;

    return matchesOrigin && matchesDestination && matchesLevel;
  });

  const selectedTrip = state.trips.find((t) => t.id === selectedTripId);
  const selectedVehicle = selectedTrip ? state.vehicles.find((v) => v.id === selectedTrip.vehicleId) : null;
  const selectedRoute = selectedTrip ? state.routes.find((r) => r.id === selectedTrip.routeId) : null;
  const currentSeatInventory = selectedTripId ? state.seatInventories[selectedTripId] || [] : [];

  // Handle seat click with 10-minute pessimistic hold lock
  const handleSeatClick = (seat: SeatInventoryItem) => {
    if (!selectedTripId) return;

    if (seat.state === 'RESERVED' || seat.state === 'CHECKED_IN') {
      setActionMessage({
        type: 'error',
        text: `Seat ${seat.seatNumber} is already reserved by another passenger.`,
      });
      return;
    }

    // Release old lock if different seat was clicked
    if (selectedSeatNumber && selectedSeatNumber !== seat.seatNumber) {
      const updated = unlockSeat(state, selectedTripId, selectedSeatNumber, passengerPhone);
      setState(updated);
    }

    // Acquire 10-min lock
    const { updatedState, result } = lockSeat(
      state,
      selectedTripId,
      seat.seatNumber,
      passengerPhone,
      passengerName
    );

    setState(updatedState);

    if (result.success && result.lockExpiresAt) {
      setSelectedSeatNumber(seat.seatNumber);
      setLockExpiresAt(result.lockExpiresAt);
      setActionMessage({
        type: 'success',
        text: `Seat S-${seat.seatNumber} locked for 10 minutes. Click 'Proceed to Payment' to finalize.`,
      });
    } else {
      setActionMessage({
        type: 'error',
        text: result.message,
      });
    }
  };

  // Finalize payment & booking
  const handleConfirmPayment = () => {
    if (!selectedTripId || !selectedSeatNumber) return;

    setIsProcessingPayment(true);
    setActionMessage({
      type: 'info',
      text: `Handshaking with ${paymentMethod} gateway... Authenticating secure transaction PIN...`,
    });

    setTimeout(() => {
      const { updatedState, ticket, error } = confirmTicketBooking(
        state,
        selectedTripId,
        selectedSeatNumber,
        passengerName,
        passengerPhone,
        paymentMethod,
        false
      );

      setIsProcessingPayment(false);
      setState(updatedState);

      if (error || !ticket) {
        setActionMessage({
          type: 'error',
          text: error || 'Payment failed or seat lock expired.',
        });
      } else {
        setShowCheckoutModal(false);
        setLockExpiresAt(null);
        setSelectedSeatNumber(null);
        setSelectedTripId(null);
        setActiveBoardingPass(ticket);
        setActionMessage({
          type: 'success',
          text: `Ticket ${ticket.ticketNumber} successfully booked! Your official QR Boarding Pass is ready.`,
        });
      }
    }, 1200);
  };

  // Handle cancellation
  const handleCancelTicket = (ticketId: string) => {
    const { updatedState, success, message } = cancelTicketReservation(state, ticketId, 'TRAVELER');
    setState(updatedState);
    setActionMessage({
      type: success ? 'success' : 'error',
      text: message,
    });
  };

  const userTickets = state.tickets.filter((t) => t.passengerPhone === currentUser.phone);
  const activeUserTickets = userTickets.filter((t) => t.status === 'RESERVED' || t.status === 'CHECKED_IN');
  const pastUserTickets = userTickets.filter((t) => t.status === 'CANCELLED' || t.status === 'REFUNDED');

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <Shield className="w-4 h-4" />
              <span>Official ETA Public Booking Portal</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-1">
              {locale === 'am' ? 'የጉዞ ትኬት መቁረጫ እና የቦርዲንግ ፓስ' : 'Inter-City Vehicle Booking & Seat Reservation'}
            </h1>
            <p className="text-slate-300 text-xs mt-1 max-w-2xl">
              {locale === 'am'
                ? 'የቀጥታ የታሪፍ ስሌት፣ የ10 ደቂቃ የወንበር መያዣ ጊዜ፣ እና ፈጣን የቴሌብር/ሲቢኢ ብር ክፍያ። በአንድ ጉዞ አንድ ወንበር ብቻ መያዝ ይፈቀዳል።'
                : 'Direct ETA regulated fares, 10-minute atomic hold lock, and instant Telebirr/CBE Birr checkout with single-ticket seat guarantee.'}
            </p>
          </div>

          {/* Tab Pill Switcher */}
          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'search'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              {t.searchTrips}
            </button>
            <button
              onClick={() => setActiveTab('myTrips')}
              className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'myTrips'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              {t.myTrips}
              {activeUserTickets.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                  {activeUserTickets.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications / System Alerts */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm transition ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : actionMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-300'
              : 'bg-blue-50 text-blue-800 border border-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
            {actionMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
            {actionMessage.type === 'info' && <Lock className="w-4 h-4 text-blue-600" />}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: SEARCH & BOOKING */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          {/* Multi-Filter Search Panel */}
          <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  {t.originTerminal}
                </label>
                <select
                  value={originId}
                  onChange={(e) => setOriginId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {state.terminals.map((term) => (
                    <option key={term.id} value={term.id}>
                      {locale === 'am' ? term.nameAmharic : term.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  {t.destinationTerminal}
                </label>
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {state.terminals.map((term) => (
                    <option key={term.id} value={term.id}>
                      {locale === 'am' ? term.nameAmharic : term.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  {t.vehicleLevel}
                </label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="ALL">{t.allLevels}</option>
                  <option value="LEVEL_1">{VEHICLE_CONFIGS.LEVEL_1.name}</option>
                  <option value="LEVEL_2">{VEHICLE_CONFIGS.LEVEL_2.name}</option>
                  <option value="LEVEL_3">{VEHICLE_CONFIGS.LEVEL_3.name}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  {t.travelDate}
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Search Results Feed */}
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center justify-between">
              <span>
                {matchingTrips.length} {locale === 'am' ? 'የተገኙ ጉዞዎች' : 'Available Trip Schedules Found'}
              </span>
              <span className="text-xs font-normal text-slate-500">
                Woldia Menehariya Live Dispatch Network
              </span>
            </h2>

            {matchingTrips.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Bus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-slate-700">No Direct Trips Found for this Route</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Try switching origin/destination terminals or setting vehicle level to "All Levels".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {matchingTrips.map((trip) => {
                  const vehicle = state.vehicles.find((v) => v.id === trip.vehicleId);
                  const route = state.routes.find((r) => r.id === trip.routeId);
                  const origin = state.terminals.find((t) => t.id === route?.originTerminalId);
                  const dest = state.terminals.find((t) => t.id === route?.destinationTerminalId);
                  const seats = state.seatInventories[trip.id] || [];
                  const openSeatsCount = seats.filter((s) => s.state === 'AVAILABLE').length;
                  const dualDep = formatDualDate(trip.departureTime);
                  const isSelected = selectedTripId === trip.id;

                  return (
                    <div
                      key={trip.id}
                      className={`bg-white rounded-2xl p-5 shadow-sm border transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        {/* Header: Origin -> Destination */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                              {vehicle ? VEHICLE_CONFIGS[vehicle.level].name : 'Transit'}
                            </span>
                            <div className="text-base font-extrabold text-slate-900 mt-1">
                              {origin?.name.split(' ')[0]} ➔ {dest?.name.split(' ')[0]}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-emerald-700">
                              {trip.totalFare.toFixed(2)} ETB
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              Incl. 10 ETB Station Fee
                            </span>
                          </div>
                        </div>

                        {/* Timing & Vehicle Specs */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600 mb-4">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-semibold text-slate-800">{dualDep.gregorian}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            የኢትዮጵያ ቀን: <span className="font-medium text-slate-700">{dualDep.ethiopian}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-slate-200 text-[11px]">
                            <span>ርቀት: {trip.distanceKm} ኪ.ሜ</span>
                            <span className="font-semibold text-slate-800">
                              ታርጋ: {vehicle?.licensePlate || '3-90038 AA'}
                            </span>
                          </div>
                        </div>

                        {/* Seat Availability Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500 font-medium">{t.availableSeats}:</span>
                            <span className="font-bold text-slate-900">
                              {openSeatsCount} of {seats.length} Open
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${(openSeatsCount / (seats.length || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedTripId(trip.id);
                          setSelectedSeatNumber(null);
                          setLockExpiresAt(null);
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <span>{isSelected ? '✓ Viewing Cabin Layout' : 'Select Vehicle & View Seats'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Cabin Seating Map */}
          {selectedTrip && (
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-emerald-200">
              {/* Header and Countdown */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <h3 className="font-extrabold text-base text-slate-900">
                      {t.seatMap} ({selectedVehicle ? VEHICLE_CONFIGS[selectedVehicle.level].name : 'Bus'})
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.singleSeatWarning}
                  </p>
                </div>

                {/* 10-Minute Countdown Clock Banner */}
                {lockExpiresAt && countdownSeconds > 0 ? (
                  <div className="bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm animate-pulse border border-amber-600">
                    <Clock className="w-4 h-4 text-slate-950" />
                    <span>
                      {t.lockExpiresIn}: {Math.floor(countdownSeconds / 60)}:
                      {(countdownSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    No active seat lock. Click an open seat to hold for 10 min.
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 py-3 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-400" />
                  <span>Available (ክፍት)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-emerald-600 border border-emerald-700 text-white flex items-center justify-center text-[9px] font-bold">
                    ✓
                  </div>
                  <span>Selected (የተመረጠ)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-amber-200 border border-amber-400" />
                  <span>10-Min Hold Lock (የተያዘ)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-slate-300 border border-slate-400 text-slate-600 flex items-center justify-center text-[9px]">
                    ✕
                  </div>
                  <span>Booked / Reserved (የተሸጠ)</span>
                </div>
              </div>

              {/* Visual Cabin Grid */}
              <div className="bg-slate-100 p-6 rounded-2xl border border-slate-300 max-w-xl mx-auto my-4">
                {/* Windshield / Driver Compartment */}
                <div className="bg-slate-800 text-slate-300 p-2.5 rounded-t-xl text-center text-xs font-mono font-bold tracking-widest uppercase mb-6 flex justify-between px-4 items-center">
                  <span>[ DOOR / መግቢያ ]</span>
                  <span>BUS FRONT / የፊት መስታወት</span>
                  <span>[ DRIVER / አሽከርካሪ ]</span>
                </div>

                {/* Seating Grid Layout */}
                <div className="grid grid-cols-5 gap-2.5">
                  {currentSeatInventory.map((seat, index) => {
                    const isSelected = selectedSeatNumber === seat.seatNumber;
                    const isBooked = seat.state === 'RESERVED' || seat.state === 'CHECKED_IN';
                    const isLockedByOther = Boolean(
                      seat.state === 'LOCKED' &&
                      seat.lockedByPhone !== passengerPhone &&
                      seat.lockExpiresAt &&
                      seat.lockExpiresAt > Date.now()
                    );

                    // Insert center aisle spacer every 5 seats (e.g. 2 seats - aisle - 2 seats)
                    return (
                      <React.Fragment key={seat.seatNumber}>
                        <button
                          onClick={() => handleSeatClick(seat)}
                          disabled={isBooked || isLockedByOther}
                          className={`relative p-2 h-14 rounded-xl flex flex-col items-center justify-center font-mono text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-bold shadow-lg ring-2 ring-emerald-400 scale-105'
                              : isBooked
                              ? 'bg-slate-300 text-slate-500 border border-slate-300 cursor-not-allowed opacity-60'
                              : isLockedByOther
                              ? 'bg-amber-100 border border-amber-400 text-amber-800 cursor-not-allowed'
                              : 'bg-white hover:bg-emerald-50 text-slate-800 border border-slate-300 hover:border-emerald-500 shadow-sm'
                          }`}
                        >
                          <span className="text-[10px] text-slate-400">S</span>
                          <span className="font-extrabold text-sm">{seat.seatNumber}</span>
                          {isSelected && <span className="text-[9px] uppercase font-bold mt-0.5">Hold</span>}
                          {isLockedByOther && <span className="text-[8px] font-bold text-amber-700">Lock</span>}
                        </button>
                        {index % 4 === 1 && <div className="w-3" />}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Bus Rear */}
                <div className="mt-6 text-center text-[11px] text-slate-400 font-mono">
                  ─── VEHICLE REAR / የኋላ መቀመጫ ───
                </div>
              </div>

              {/* Checkout Initiation Bar */}
              {selectedSeatNumber && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      S-{selectedSeatNumber}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-emerald-950">
                        Seat S-{selectedSeatNumber} Reserved for 10 Minutes
                      </div>
                      <div className="text-xs text-emerald-700">
                        Total Amount Due: <span className="font-extrabold">{selectedTrip.totalFare.toFixed(2)} ETB</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowCheckoutModal(true)}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{t.proceedCheckout}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY TRIPS & PASSES */}
      {activeTab === 'myTrips' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900">
              {locale === 'am' ? 'የተያዙ ትኬቶች እና የቦርዲንግ ፓስ' : 'Your Booked Trips & Digital Boarding Passes'}
            </h2>
            <span className="text-xs text-slate-500">
              Registered Phone: <span className="font-mono font-bold text-slate-800">{currentUser.phone}</span>
            </span>
          </div>

          {userTickets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700">No Reservations Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                You have not booked any trips yet. Search and reserve your single seat above!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userTickets.map((tkt) => {
                const trip = state.trips.find((tp) => tp.id === tkt.tripId);
                const vehicle = trip ? state.vehicles.find((v) => v.id === trip.vehicleId) : null;
                const route = trip ? state.routes.find((r) => r.id === trip.routeId) : null;
                const origin = state.terminals.find((tm) => tm.id === route?.originTerminalId);
                const dest = state.terminals.find((tm) => tm.id === route?.destinationTerminalId);
                const dualDep = trip ? formatDualDate(trip.departureTime) : { gregorian: 'N/A', ethiopian: 'N/A' };
                const isCancelled = tkt.status === 'CANCELLED' || tkt.status === 'REFUNDED';
                const isCheckedIn = tkt.status === 'CHECKED_IN';

                return (
                  <div
                    key={tkt.id}
                    className={`bg-white rounded-2xl p-5 shadow-sm border transition flex flex-col justify-between ${
                      isCancelled
                        ? 'border-slate-200 opacity-70 bg-slate-50'
                        : isCheckedIn
                        ? 'border-blue-400 bg-blue-50/20'
                        : 'border-emerald-300 ring-1 ring-emerald-500/10'
                    }`}
                  >
                    <div>
                      {/* Ticket Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-500">
                            {tkt.ticketNumber}
                          </span>
                          <div className="text-base font-extrabold text-slate-900 mt-0.5">
                            {origin?.name || 'Woldia'} ➔ {dest?.name || 'Addis Ababa'}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isCheckedIn
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : isCancelled
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isCheckedIn ? '✓ CHECKED-IN' : isCancelled ? 'CANCELLED' : 'ACTIVE / PAID'}
                        </span>
                      </div>

                      {/* Seat, Timing & Vehicle Info */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-xs text-slate-700 mb-4">
                        <div>
                          <span className="text-slate-400 text-[10px] block">Seat Assignment:</span>
                          <span className="font-extrabold text-emerald-800 text-sm">
                            {tkt.seatCoordinate} (ቁጥር {tkt.seatNumber})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Vehicle Plate:</span>
                          <span className="font-bold text-slate-900">{vehicle?.licensePlate || '3-90038 AA'}</span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200">
                          <span className="text-slate-400 text-[10px] block">Departure Time:</span>
                          <span className="font-semibold text-slate-900">{dualDep.gregorian}</span>
                          <span className="block text-[11px] text-slate-500">{dualDep.ethiopian}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setActiveBoardingPass(tkt)}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                        <span>View Boarding Pass</span>
                      </button>

                      {!isCancelled && !isCheckedIn && (
                        <button
                          onClick={() => handleCancelTicket(tkt.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold py-2 px-3 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
                          title="Cancel ticket (allowed up to 30 min before departure)"
                        >
                          Cancel (30m rule)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CHECKOUT MODAL: 5%/95% BREAKDOWN & TELEBIRR / CBE BIRR M-PIN SIMULATOR */}
      {showCheckoutModal && selectedTrip && selectedSeatNumber && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  Ethiopian National Transit Gateway
                </span>
                <h3 className="text-lg font-bold">Secure Digital Checkout</h3>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Itemized Fare & Split Summary (PRD Section 4.7.1) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">
                  Trip Fare & Regulatory Split Breakdown
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Base Distance Tariff ({selectedTrip.distanceKm} km @ {selectedTrip.baseRatePerKm} ETB):</span>
                  <span>{(selectedTrip.distanceKm * selectedTrip.baseRatePerKm).toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Vehicle Level Multiplier ({selectedVehicle ? VEHICLE_CONFIGS[selectedVehicle.level].name : 'Level 2'}):</span>
                  <span>x{selectedTrip.levelModifier}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Terminal Station Overhead Fee:</span>
                  <span>10.00 ETB</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Amount to Pay:</span>
                  <span className="text-emerald-700">{selectedTrip.totalFare.toFixed(2)} ETB</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 mt-2 text-[11px] text-slate-500 space-y-0.5">
                  <div className="flex justify-between">
                    <span>• 5% ETA Terminal Operating Share:</span>
                    <span className="font-semibold">{(selectedTrip.totalFare * 0.05).toFixed(2)} ETB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 95% Vehicle Operator Share:</span>
                    <span className="font-semibold">{(selectedTrip.totalFare * 0.95).toFixed(2)} ETB</span>
                  </div>
                </div>
              </div>

              {/* Passenger Verification Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Passenger Name</label>
                  <input
                    type="text"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              {/* Payment Rail Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TELEBIRR')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      paymentMethod === 'TELEBIRR'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-sm text-emerald-700">telebirr</div>
                    <div className="text-[10px] text-slate-500">Ethio Telecom</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CBE_BIRR')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      paymentMethod === 'CBE_BIRR'
                        ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-sm text-purple-700">CBE Birr</div>
                    <div className="text-[10px] text-slate-500">Com. Bank of ET</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CHAPA')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      paymentMethod === 'CHAPA'
                        ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-sm text-blue-700">Chapa</div>
                    <div className="text-[10px] text-slate-500">Card / Wallet</div>
                  </button>
                </div>
              </div>

              {/* Simulated Mobile PIN input */}
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter {paymentMethod} 4-Digit M-PIN:
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={pinPrompt}
                  onChange={(e) => setPinPrompt(e.target.value)}
                  className="w-full text-center text-lg font-mono tracking-widest bg-white border border-slate-300 rounded-lg py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <span className="block text-[10px] text-slate-400 text-center mt-1">
                  Simulated sandbox environment: any 4 digits (e.g. 1234) will approve.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                onClick={handleConfirmPayment}
                disabled={isProcessingPayment}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Processing Payment & Splitting Revenue...
                  </span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Authorize {selectedTrip.totalFare.toFixed(2)} ETB Payment</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TICKET / BOARDING PASS MODAL */}
      {activeBoardingPass && (
        <BoardingPassModal
          ticket={activeBoardingPass}
          trip={state.trips.find((t) => t.id === activeBoardingPass.tripId)}
          route={state.routes.find(
            (r) =>
              r.id === state.trips.find((tp) => tp.id === activeBoardingPass.tripId)?.routeId
          )}
          vehicle={state.vehicles.find(
            (v) =>
              v.id === state.trips.find((tp) => tp.id === activeBoardingPass.tripId)?.vehicleId
          )}
          origin={state.terminals.find(
            (tm) =>
              tm.id ===
              state.routes.find(
                (r) =>
                  r.id ===
                  state.trips.find((tp) => tp.id === activeBoardingPass.tripId)?.routeId
              )?.originTerminalId
          )}
          destination={state.terminals.find(
            (tm) =>
              tm.id ===
              state.routes.find(
                (r) =>
                  r.id ===
                  state.trips.find((tp) => tp.id === activeBoardingPass.tripId)?.routeId
              )?.destinationTerminalId
          )}
          onClose={() => setActiveBoardingPass(null)}
        />
      )}
    </div>
  );
};
