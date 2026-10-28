/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AppState,
  ScheduledTrip,
  User,
} from '../types';
import { Locale, TRANSLATIONS } from '../utils/translations';
import { formatDualDate } from '../utils/ethiopianCalendar';
import { checkDriverManifestVisibility } from '../services/dispatchService';
import {
  Bus,
  Lock,
  Unlock,
  Users,
  CheckCircle2,
  Clock,
  DollarSign,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';

interface DriverPortalProps {
  currentUser: User;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  locale: Locale;
}

export const DriverPortal: React.FC<DriverPortalProps> = ({
  currentUser,
  state,
  setState,
  locale,
}) => {
  const t = TRANSLATIONS[locale];
  const [driverAlert, setDriverAlert] = useState<string | null>(null);

  // Find driver record linked to this user or fallback to first driver
  const driverRecord =
    state.drivers.find((d) => d.phone === currentUser.phone || d.userId === currentUser.id) ||
    state.drivers[0];

  // Find vehicle assigned to this driver
  const assignedVehicle = state.vehicles.find((v) => v.assignedDriverId === driverRecord?.id);

  // Find trips assigned to this driver
  const driverTrips = state.trips.filter((t) => t.driverId === driverRecord?.id);
  const activeTrip = driverTrips[0] || state.trips[0];

  const route = activeTrip ? state.routes.find((r) => r.id === activeTrip.routeId) : null;
  const origin = state.terminals.find((t) => t.id === route?.originTerminalId);
  const dest = state.terminals.find((t) => t.id === route?.destinationTerminalId);

  // Check 2-hour departure visibility window
  const visibility = activeTrip
    ? checkDriverManifestVisibility(activeTrip.departureTime)
    : { visible: false, remainingMinutes: 999, departureTimeStr: '' };

  // Get manifest passengers for active trip
  const tripTickets = activeTrip
    ? state.tickets.filter((tkt) => tkt.tripId === activeTrip.id && tkt.status !== 'CANCELLED')
    : [];

  const boardedCount = tripTickets.filter((tkt) => tkt.status === 'CHECKED_IN').length;
  const operatorTotalEarnings = tripTickets.reduce((acc, tkt) => acc + tkt.operatorShare, 0);

  const dualDep = activeTrip ? formatDualDate(activeTrip.departureTime) : { gregorian: 'N/A', ethiopian: 'N/A' };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-amber-900/40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Bus className="w-4 h-4" />
              <span>Operator & Verified Driver Terminal Portal</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-1">
              {driverRecord ? driverRecord.fullName : 'Haile Kebede'} (Driver Cockpit)
            </h1>
            <p className="text-slate-300 text-xs mt-1">
              License: <span className="font-mono font-bold">{driverRecord?.licenseNumber}</span> • Association: <span className="font-semibold text-amber-300">Semen Wolo Transport</span>
            </p>
          </div>

          <div className="bg-slate-950/80 px-4 py-2.5 rounded-xl border border-amber-900/50 text-right">
            <span className="text-[10px] text-slate-400 block uppercase">Assigned Vehicle</span>
            <span className="text-base font-extrabold text-amber-400 font-mono">
              {assignedVehicle?.licensePlate || '3-90038 AA'}
            </span>
            <span className="text-[11px] text-slate-400 block">Side #{assignedVehicle?.sideNumber || '412'}</span>
          </div>
        </div>
      </div>

      {/* Active Dispatched Voyage Card */}
      {activeTrip && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 uppercase">
                Active Rotation Voyage
              </span>
              <h2 className="text-lg font-extrabold text-slate-900 mt-1">
                {origin?.name} ➔ {dest?.name}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Departure Window:</span>
              <span className="text-sm font-bold text-slate-900">{dualDep.gregorian}</span>
              <span className="text-xs text-slate-600 block">{dualDep.ethiopian}</span>
            </div>
          </div>

          {/* Key Metrics: Boarded vs Total, 95% Earnings, Manifest Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Boarding Status</span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {boardedCount} / {tripTickets.length}
              </div>
              <span className="text-[11px] text-slate-500">
                {tripTickets.length - boardedCount} passengers awaiting gate check-in
              </span>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase">Your 95% Revenue Share</span>
                <DollarSign className="w-4 h-4 text-amber-700" />
              </div>
              <div className="text-2xl font-black text-amber-950 mt-2">
                {operatorTotalEarnings.toFixed(2)} ETB
              </div>
              <span className="text-[11px] text-amber-700">
                5% terminal administrative fee auto-deducted
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Manifest Gate</span>
                {visibility.visible ? (
                  <Unlock className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Lock className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-2">
                {visibility.visible ? 'UNLOCKED' : 'SEALED (2-HOUR RULE)'}
              </div>
              <span className="text-[11px] text-slate-500">
                {visibility.visible
                  ? 'Active access permitted for pre-departure count'
                  : `Unlocks in ${visibility.remainingMinutes} min (ETA Regulation)`}
              </span>
            </div>
          </div>

          {/* MANIFEST SECTION WITH 2-HOUR RESTRICTION GUARD */}
          {!visibility.visible ? (
            /* Locked Viewport */
            <div className="bg-slate-900 text-white p-8 rounded-2xl border border-slate-800 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                <Lock className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Passenger Manifest Sealed</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {t.driverManifestNotice}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl text-xs font-mono text-amber-300 border border-slate-700">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Scheduled Departure: {visibility.departureTimeStr} (Unlocks within 120 minutes)</span>
              </div>
            </div>
          ) : (
            /* Unlocked Official Passenger Manifest Table */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Official Passenger Manifest (Pre-Departure Board)
                  </h3>
                </div>
                {activeTrip.manifestLocked && (
                  <span className="bg-purple-100 text-purple-900 text-xs font-bold px-3 py-1 rounded-full border border-purple-200">
                    🔒 Manifest Locked (≥80% Capacity Reached)
                  </span>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Seat</th>
                      <th className="p-3">Passenger Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Ticket No</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3">95% Share</th>
                      <th className="p-3">Boarding Clearance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {tripTickets.map((tkt) => (
                      <tr
                        key={tkt.id}
                        className={tkt.status === 'CHECKED_IN' ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}
                      >
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {tkt.seatCoordinate}
                        </td>
                        <td className="p-3 font-semibold text-slate-800">{tkt.passengerName}</td>
                        <td className="p-3 font-mono text-slate-600">{tkt.passengerPhone}</td>
                        <td className="p-3 font-mono text-slate-500">{tkt.ticketNumber}</td>
                        <td className="p-3 uppercase font-medium text-slate-700">{tkt.paymentMethod}</td>
                        <td className="p-3 font-bold text-amber-700">{tkt.operatorShare.toFixed(2)} ETB</td>
                        <td className="p-3">
                          {tkt.status === 'CHECKED_IN' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                              <CheckCircle2 className="w-3 h-3" />
                              CLEAR TO BOARD
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full text-[10px]">
                              <Clock className="w-3 h-3" />
                              RESERVED (AT GATE)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-xs text-slate-500">
                  Status: <span className="font-extrabold text-slate-900 uppercase">{activeTrip.status}</span>
                </div>
                {activeTrip.status !== 'DEPARTED' ? (
                  <button
                    onClick={() => {
                      setState((prev) => {
                        const updatedTrips = prev.trips.map((tr) =>
                          tr.id === activeTrip.id ? { ...tr, status: 'DEPARTED' as const } : tr
                        );
                        return {
                          ...prev,
                          trips: updatedTrips,
                          auditLogs: [
                            {
                              id: `log-${Date.now()}`,
                              timestamp: new Date().toISOString(),
                              userId: currentUser.phone,
                              userName: currentUser.name,
                              role: 'OPERATOR_DRIVER',
                              action: 'TRIP_DEPARTED',
                              details: `Trip ${activeTrip.id} authorized for departure. Vehicle ${assignedVehicle?.licensePlate} dispatched from terminal gate with ${boardedCount} boarded passengers.`,
                            },
                            ...prev.auditLogs,
                          ],
                        };
                      });
                      setDriverAlert('Departure Authorized! Vehicle has officially cleared terminal gate.');
                    }}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Authorize Departure & Clear Gate (Stage 4)</span>
                  </button>
                ) : (
                  <span className="bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs">
                    ✓ VOYAGE DEPARTED & ON ROUTE
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
