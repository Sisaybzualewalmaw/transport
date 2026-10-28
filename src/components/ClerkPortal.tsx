/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AppState,
  ScheduledTrip,
  TicketReservation,
  User,
} from '../types';
import { Locale, TRANSLATIONS } from '../utils/translations';
import { formatDualDate } from '../utils/ethiopianCalendar';
import { confirmTicketBooking, checkInPassengerByCode } from '../services/bookingService';
import { BoardingPassModal } from './BoardingPassModal';
import {
  QrCode,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Search,
  Printer,
  ShieldCheck,
  Camera,
} from 'lucide-react';

interface ClerkPortalProps {
  currentUser: User;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  locale: Locale;
  initialTab?: 'walkIn' | 'gateScan';
}

export const ClerkPortal: React.FC<ClerkPortalProps> = ({
  currentUser,
  state,
  setState,
  locale,
  initialTab = 'walkIn',
}) => {
  const t = TRANSLATIONS[locale];

  const [activeTab, setActiveTab] = useState<'walkIn' | 'gateScan'>(initialTab);

  // Walk-in booking state
  const [selectedTripId, setSelectedTripId] = useState<string>(state.trips[0]?.id || '');
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<number | null>(null);
  const [passengerName, setPassengerName] = useState<string>('');
  const [passengerPhone, setPassengerPhone] = useState<string>('09');
  const [cashCollected, setCashCollected] = useState<boolean>(true);

  // Scanner state
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    ticket?: TicketReservation;
  } | null>(null);

  // Boarding Pass Print Modal
  const [printedTicket, setPrintedTicket] = useState<TicketReservation | null>(null);
  const [systemAlert, setSystemAlert] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const selectedTrip = state.trips.find((t) => t.id === selectedTripId);
  const selectedVehicle = selectedTrip ? state.vehicles.find((v) => v.id === selectedTrip.vehicleId) : null;
  const seats = selectedTrip ? state.seatInventories[selectedTrip.id] || [] : [];
  const openSeats = seats.filter((s) => s.state === 'AVAILABLE');

  // Process Walk-in Cash Booking
  const handleWalkInBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId || !selectedSeatNumber) {
      setSystemAlert({ type: 'error', text: 'Please select an open seat on the map.' });
      return;
    }
    if (!passengerName.trim()) {
      setSystemAlert({ type: 'error', text: 'Please enter passenger full name.' });
      return;
    }
    if (!/^(09\d{8}|\+2519\d{8})$/.test(passengerPhone.trim())) {
      setSystemAlert({ type: 'error', text: 'Enter a valid Ethiopian passenger phone number.' });
      return;
    }

    const { updatedState, ticket, error } = confirmTicketBooking(
      state,
      selectedTripId,
      selectedSeatNumber,
      passengerName,
      passengerPhone,
      'CASH_POS',
      true
    );

    setState(updatedState);

    if (error || !ticket) {
      setSystemAlert({ type: 'error', text: error || 'Failed to issue walk-in ticket.' });
    } else {
      setSelectedSeatNumber(null);
      setPassengerName('');
      setPassengerPhone('09');
      setPrintedTicket(ticket);
      setSystemAlert({
        type: 'success',
        text: `Walk-in Ticket ${ticket.ticketNumber} successfully generated! Print thermal slip below.`,
      });
    }
  };

  // Process Gate Check-In Code
  const handleVerifyCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualCodeInput.trim()) return;

    const { updatedState, success, message, ticket } = checkInPassengerByCode(
      state,
      manualCodeInput,
      currentUser.name
    );

    setState(updatedState);
    setScanResult({ success, message, ticket });
    if (success) {
      setManualCodeInput('');
    }
  };

  // Sample quick scan trigger for testing
  const handleSimulatedScan = (code: string) => {
    setManualCodeInput(code);
    const { updatedState, success, message, ticket } = checkInPassengerByCode(
      state,
      code,
      currentUser.name
    );
    setState(updatedState);
    setScanResult({ success, message, ticket });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
            <UserCheck className="w-4 h-4" />
            <span>Terminal Station Clerk Operations</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Woldia Menehariya Point of Sale & Gate Verification
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Official counter terminal for walk-in passenger cash ticketing, gate camera scanning, and boarding clearance.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('walkIn')}
            className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'walkIn'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            {t.walkInBooking}
          </button>
          <button
            onClick={() => setActiveTab('gateScan')}
            className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'gateScan'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            {t.scanQrGate}
          </button>
        </div>
      </div>

      {systemAlert && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            systemAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-rose-50 text-rose-800 border border-rose-300'
          }`}
        >
          <span>{systemAlert.text}</span>
          <button onClick={() => setSystemAlert(null)} className="cursor-pointer font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: WALK-IN BOOKING DESK */}
      {activeTab === 'walkIn' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Form: Select Trip & Passenger Details */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-1 space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
              <Printer className="w-4 h-4 text-blue-600" />
              <span>Issue Walk-in Cash Ticket</span>
            </h2>

            <form onSubmit={handleWalkInBooking} className="space-y-4">
              {/* Trip Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Active Dispatched Route
                </label>
                <select
                  value={selectedTripId}
                  onChange={(e) => {
                    setSelectedTripId(e.target.value);
                    setSelectedSeatNumber(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                >
                  {state.trips.map((trip) => {
                    const route = state.routes.find((r) => r.id === trip.routeId);
                    const origin = state.terminals.find((t) => t.id === route?.originTerminalId);
                    const dest = state.terminals.find((t) => t.id === route?.destinationTerminalId);
                    return (
                      <option key={trip.id} value={trip.id}>
                        {origin?.name.split(' ')[0]} ➔ {dest?.name.split(' ')[0]} ({trip.totalFare} ETB)
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedTrip && (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
                  <div className="flex justify-between">
                    <span>Departure:</span>
                    <span className="font-bold">
                      {formatDualDate(selectedTrip.departureTime).gregorian}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fare Amount:</span>
                    <span className="font-extrabold text-sm">{selectedTrip.totalFare.toFixed(2)} ETB</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-blue-700">
                    <span>Open Seats:</span>
                    <span className="font-bold">{openSeats.length} of {seats.length}</span>
                  </div>
                </div>
              )}

              {/* Selected Seat Indicator */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Selected Seat Number
                </label>
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 text-center font-bold text-slate-800 text-sm">
                  {selectedSeatNumber ? `Seat S-${selectedSeatNumber}` : '← Click an open seat on map'}
                </div>
              </div>

              {/* Passenger Inputs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Passenger Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Almaz Bekele"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Passenger Phone Number
                </label>
                <input
                  type="text"
                  placeholder="0911223344"
                  value={passengerPhone}
                  onChange={(e) => setPassengerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>

              {/* Cash Collection Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                <input
                  type="checkbox"
                  id="cashCheck"
                  checked={cashCollected}
                  onChange={(e) => setCashCollected(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="cashCheck" className="text-emerald-950 font-bold">
                  Cash payment received at counter window
                </label>
              </div>

              <button
                type="submit"
                disabled={!selectedSeatNumber || !cashCollected}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{t.collectCash}</span>
              </button>
            </form>
          </div>

          {/* Right Map: Visual Seating Map for Selected Trip */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-2">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Select Seat for Walk-in Passenger
                </h3>
                <span className="text-xs text-slate-500">
                  Assigned Vehicle: <span className="font-bold text-slate-800">{selectedVehicle?.licensePlate || '3-90038 AA'}</span> ({selectedVehicle?.level || 'LEVEL_2'})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-white border border-slate-400" /> Open
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-blue-600" /> Picked
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-slate-300" /> Sold
                </span>
              </div>
            </div>

            {/* Seat Grid */}
            <div className="bg-slate-100 p-4 rounded-2xl border border-slate-300 max-w-lg mx-auto">
              <div className="grid grid-cols-5 gap-2">
                {seats.map((seat, index) => {
                  const isSelected = selectedSeatNumber === seat.seatNumber;
                  const isTaken = seat.state === 'RESERVED' || seat.state === 'CHECKED_IN';
                  return (
                    <React.Fragment key={seat.seatNumber}>
                      <button
                        type="button"
                        onClick={() => setSelectedSeatNumber(seat.seatNumber)}
                        disabled={isTaken}
                        className={`h-12 rounded-xl flex flex-col items-center justify-center text-xs font-mono font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                            : isTaken
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                            : 'bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 shadow-sm'
                        }`}
                      >
                        <span className="text-[9px] text-slate-400">S</span>
                        <span>{seat.seatNumber}</span>
                      </button>
                      {index % 4 === 1 && <div className="w-2" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GATE QR CODE SCANNER & VERIFICATION */}
      {activeTab === 'gateScan' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scanner Console */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-2 space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <span>Gate Optical Scanner & Ticket Verification</span>
            </h2>

            {/* Simulated Camera Viewfinder */}
            <div className="relative bg-slate-950 rounded-2xl p-8 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-center overflow-hidden min-h-[260px]">
              <div className="w-48 h-48 border-2 border-emerald-400 rounded-2xl relative flex items-center justify-center shadow-lg shadow-emerald-950/50">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400 shadow-sm shadow-emerald-400 animate-bounce" />
                <QrCode className="w-24 h-24 text-slate-600" />
              </div>
              <p className="text-xs text-slate-400 mt-4 max-w-sm">
                Optical camera gate scanner active. Position traveler's QR code within target framing.
              </p>
            </div>

            {/* Manual Serial String Entry (UC-19 Alt Flow 1) */}
            <form onSubmit={handleVerifyCode} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Ticket Code (e.g. ET-VER-778812 or ET-WL-31050)"
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs font-mono font-bold tracking-wider text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify Code</span>
              </button>
            </form>

            {/* Scan Result Feedback */}
            {scanResult && (
              <div
                className={`p-5 rounded-2xl border text-xs ${
                  scanResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  {scanResult.success ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-rose-600 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-extrabold text-sm">{scanResult.message}</h4>
                    {scanResult.ticket && (
                      <div className="mt-2 grid grid-cols-2 gap-2 bg-white/75 p-3 rounded-xl border border-current text-xs">
                        <div>
                          <span className="text-slate-500 block">Passenger Name:</span>
                          <span className="font-bold">{scanResult.ticket.passengerName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Assigned Seat:</span>
                          <span className="font-extrabold text-emerald-700 text-sm">
                            {scanResult.ticket.seatCoordinate} (ቁጥር {scanResult.ticket.seatNumber})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Ticket No:</span>
                          <span className="font-mono">{scanResult.ticket.ticketNumber}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Status:</span>
                          <span className="font-bold text-emerald-600">✓ BOARDED</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Quick Test Barcodes & Today's Manifest */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-1 space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider">
              Quick Scan Verification Tokens
            </h3>
            <p className="text-xs text-slate-500">
              Click any active passenger token below to simulate handheld gate camera verification:
            </p>

            <div className="space-y-2">
              {state.tickets.slice(0, 5).map((tkt) => (
                <button
                  key={tkt.id}
                  onClick={() => handleSimulatedScan(tkt.verificationCode)}
                  className={`w-full p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex justify-between items-center ${
                    tkt.status === 'CHECKED_IN'
                      ? 'bg-blue-50/50 border-blue-200 text-slate-500'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold">{tkt.passengerName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {tkt.verificationCode} • S-{tkt.seatNumber}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      tkt.status === 'CHECKED_IN'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {tkt.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Boarding Pass Print Modal */}
      {printedTicket && (
        <BoardingPassModal
          ticket={printedTicket}
          trip={state.trips.find((t) => t.id === printedTicket.tripId)}
          route={state.routes.find(
            (r) =>
              r.id === state.trips.find((tp) => tp.id === printedTicket.tripId)?.routeId
          )}
          vehicle={state.vehicles.find(
            (v) =>
              v.id === state.trips.find((tp) => tp.id === printedTicket.tripId)?.vehicleId
          )}
          origin={state.terminals.find(
            (tm) =>
              tm.id ===
              state.routes.find(
                (r) =>
                  r.id ===
                  state.trips.find((tp) => tp.id === printedTicket.tripId)?.routeId
              )?.originTerminalId
          )}
          destination={state.terminals.find(
            (tm) =>
              tm.id ===
              state.routes.find(
                (r) =>
                  r.id ===
                  state.trips.find((tp) => tp.id === printedTicket.tripId)?.routeId
              )?.destinationTerminalId
          )}
          onClose={() => setPrintedTicket(null)}
        />
      )}
    </div>
  );
};
