/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AppState,
  Vehicle,
  VehicleLevel,
} from '../types';
import { Locale, TRANSLATIONS } from '../utils/translations';
import { VEHICLE_CONFIGS } from '../services/tariffEngine';
import {
  enrollVehicleInFIFOQueue,
  assignFIFORotation,
  handleVehicleBreakdownSubstitution,
} from '../services/dispatchService';
import {
  Bus,
  Layers,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';

interface ManagerPortalProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  locale: Locale;
}

export const ManagerPortal: React.FC<ManagerPortalProps> = ({
  state,
  setState,
  locale,
}) => {
  const t = TRANSLATIONS[locale];

  const [activeTab, setActiveTab] = useState<'fifo' | 'fleet' | 'breakdown'>('fifo');

  // FIFO check-in state
  const [selectedVehicleForCheckIn, setSelectedVehicleForCheckIn] = useState<string>(
    state.vehicles[0]?.id || ''
  );
  const [selectedDriverForCheckIn, setSelectedDriverForCheckIn] = useState<string>(
    state.drivers[0]?.id || ''
  );
  const [targetRouteForCheckIn, setTargetRouteForCheckIn] = useState<string>(
    state.routes[0]?.id || ''
  );

  // Rotation Assignment state
  const [rotationRouteId, setRotationRouteId] = useState<string>(state.routes[0]?.id || '');
  const [rotationDepartureTime, setRotationDepartureTime] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });
  const [overrideVehicleId, setOverrideVehicleId] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [showOverrideInput, setShowOverrideInput] = useState<boolean>(false);

  // Emergency Breakdown & Fleet Substitution state
  const [breakdownTripId, setBreakdownTripId] = useState<string>(state.trips[0]?.id || '');
  const [replacementVehicleId, setReplacementVehicleId] = useState<string>(
    state.vehicles.find((v) => v.id === 'veh-standby')?.id || state.vehicles[0]?.id || ''
  );

  // Add new vehicle profile state
  const [showAddVehicleModal, setShowAddVehicleModal] = useState<boolean>(false);
  const [newPlate, setNewPlate] = useState<string>('');
  const [newSideNumber, setNewSideNumber] = useState<string>('');
  const [newLevel, setNewLevel] = useState<VehicleLevel>('LEVEL_2');
  const [newDriverId, setNewDriverId] = useState<string>(state.drivers[0]?.id || '');

  const [portalAlert, setPortalAlert] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Enrolling vehicle into FIFO Queue
  const handleEnrollQueue = (e: React.FormEvent) => {
    e.preventDefault();
    const { updatedState, success, message } = enrollVehicleInFIFOQueue(
      state,
      'term-woldia',
      selectedVehicleForCheckIn,
      selectedDriverForCheckIn,
      targetRouteForCheckIn
    );

    setState(updatedState);
    setPortalAlert({
      type: success ? 'success' : 'error',
      text: message,
    });
  };

  // Assigning Top-of-Line FIFO vehicle to Route
  const handleAssignRotation = (e: React.FormEvent) => {
    e.preventDefault();
    const { updatedState, success, message } = assignFIFORotation(
      state,
      rotationRouteId,
      new Date(rotationDepartureTime).toISOString(),
      'Associate Manager (Semen Wolo)',
      showOverrideInput ? overrideVehicleId : undefined,
      showOverrideInput ? overrideReason : undefined
    );

    setState(updatedState);
    setPortalAlert({
      type: success ? 'success' : 'error',
      text: message,
    });
    if (success) {
      setShowOverrideInput(false);
      setOverrideReason('');
    }
  };

  // Emergency Breakdown Substitution
  const handleSubstitute = (e: React.FormEvent) => {
    e.preventDefault();
    const { updatedState, success, message } = handleVehicleBreakdownSubstitution(
      state,
      breakdownTripId,
      replacementVehicleId,
      'Associate Manager'
    );

    setState(updatedState);
    setPortalAlert({
      type: success ? 'success' : 'error',
      text: message,
    });
  };

  // Add New Vehicle Profile to Fleet
  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim() || !newSideNumber.trim()) {
      setPortalAlert({ type: 'error', text: 'License Plate and Side Number are mandatory.' });
      return;
    }

    // Check collision
    if (state.vehicles.some((v) => v.licensePlate.toLowerCase() === newPlate.trim().toLowerCase())) {
      setPortalAlert({ type: 'error', text: 'Registration Refused: License plate number already exists in fleet.' });
      return;
    }

    const capacity = VEHICLE_CONFIGS[newLevel].defaultCapacity;
    const newVeh: Vehicle = {
      id: `veh-${Date.now()}`,
      licensePlate: newPlate.trim().toUpperCase(),
      sideNumber: newSideNumber.trim(),
      level: newLevel,
      totalCapacity: capacity,
      associationId: 'assoc-semen-wolo',
      assignedDriverId: newDriverId,
      status: 'ACTIVE',
    };

    const updatedVehicles = [...state.vehicles, newVeh];
    const updatedState = {
      ...state,
      vehicles: updatedVehicles,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: 'MANAGER',
          userName: 'Associate Manager',
          role: 'ASSOCIATE_MANAGER' as const,
          action: 'VEHICLE_PROFILED',
          details: `New vehicle ${newVeh.licensePlate} (Level: ${newLevel}, Capacity: ${capacity} seats) registered into Semen Wolo fleet.`,
        },
        ...state.auditLogs,
      ],
    };

    setState(updatedState);
    setShowAddVehicleModal(false);
    setNewPlate('');
    setNewSideNumber('');
    setPortalAlert({
      type: 'success',
      text: `Vehicle ${newVeh.licensePlate} (${capacity} seats) successfully profiled.`,
    });
  };

  const queuedEntries = state.fifoQueues
    .filter((q) => q.status === 'QUEUED')
    .sort((a, b) => a.queuePosition - b.queuePosition);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-purple-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            <span>Association Hub & Terminal Fleet Management</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Semen Wolo Transport Logistics Control Desk
          </h1>
          <p className="text-slate-300 text-xs mt-1">
            Woldia Central Terminal Yard FIFO Queue rotation, fleet inventory profiling, and emergency breakdown management.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('fifo')}
            className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'fifo' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Terminal FIFO Queue</span>
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'fleet' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bus className="w-3.5 h-3.5" />
            <span>Fleet Inventory ({state.vehicles.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'breakdown' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
            <span>Emergency Fleet Swap</span>
          </button>
        </div>
      </div>

      {portalAlert && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            portalAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-rose-50 text-rose-800 border border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {portalAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{portalAlert.text}</span>
          </div>
          <button onClick={() => setPortalAlert(null)} className="cursor-pointer font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: TERMINAL FIFO QUEUE MANAGEMENT */}
      {activeTab === 'fifo' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Check-in Arrival & Assign Rotation */}
          <div className="space-y-6 lg:col-span-1">
            {/* Form 1: Terminal Yard Check-In (FIFO Enrollment) */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
                <Bus className="w-4 h-4 text-purple-600" />
                <span>Check-In Arriving Vehicle to Yard</span>
              </h2>

              <form onSubmit={handleEnrollQueue} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Arriving Vehicle
                  </label>
                  <select
                    value={selectedVehicleForCheckIn}
                    onChange={(e) => setSelectedVehicleForCheckIn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  >
                    {state.vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.licensePlate} (Side #{v.sideNumber} - {v.level})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Verified Driver
                  </label>
                  <select
                    value={selectedDriverForCheckIn}
                    onChange={(e) => setSelectedDriverForCheckIn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  >
                    {state.drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.licenseNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Target Route Queue Line
                  </label>
                  <select
                    value={targetRouteForCheckIn}
                    onChange={(e) => setTargetRouteForCheckIn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  >
                    {state.routes.map((r) => {
                      const orig = state.terminals.find((t) => t.id === r.originTerminalId);
                      const dest = state.terminals.find((t) => t.id === r.destinationTerminalId);
                      return (
                        <option key={r.id} value={r.id}>
                          {orig?.name.split(' ')[0]} ➔ {dest?.name.split(' ')[0]} ({r.distanceKm} km)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Enroll in FIFO Yard Queue</span>
                </button>
              </form>
            </div>

            {/* Form 2: Assign Top FIFO Vehicle to Departure Rotation */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-emerald-600" />
                <span>Assign Rotation to Upcoming Voyage</span>
              </h2>

              <form onSubmit={handleAssignRotation} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Target Route
                  </label>
                  <select
                    value={rotationRouteId}
                    onChange={(e) => setRotationRouteId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  >
                    {state.routes.map((r) => {
                      const orig = state.terminals.find((t) => t.id === r.originTerminalId);
                      const dest = state.terminals.find((t) => t.id === r.destinationTerminalId);
                      return (
                        <option key={r.id} value={r.id}>
                          {orig?.name.split(' ')[0]} ➔ {dest?.name.split(' ')[0]}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Scheduled Departure
                  </label>
                  <input
                    type="datetime-local"
                    value={rotationDepartureTime}
                    onChange={(e) => setRotationDepartureTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                {/* Queue Override Toggle */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-700">Strict FIFO Rule Applied</span>
                    <button
                      type="button"
                      onClick={() => setShowOverrideInput(!showOverrideInput)}
                      className="text-[11px] text-amber-700 hover:underline font-bold cursor-pointer"
                    >
                      {showOverrideInput ? 'Cancel Override' : 'Emergency Override?'}
                    </button>
                  </div>

                  {showOverrideInput && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 space-y-2 text-xs">
                      <span className="block font-bold text-amber-900 text-[11px]">
                        Operational Queue Bypass (Audit Logged)
                      </span>
                      <select
                        value={overrideVehicleId}
                        onChange={(e) => setOverrideVehicleId(e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs"
                      >
                        <option value="">Select bypass vehicle</option>
                        {queuedEntries.map((q) => {
                          const v = state.vehicles.find((veh) => veh.id === q.vehicleId);
                          return (
                            <option key={q.id} value={q.vehicleId}>
                              {v?.licensePlate} (Position #{q.queuePosition})
                            </option>
                          );
                        })}
                      </select>
                      <input
                        type="text"
                        placeholder="Mandatory Override Reason (e.g. Mechanical issue on #1)"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Assign & Publish Live Trip</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Live Terminal FIFO Queue Array Display */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Woldia Terminal Active FIFO Queue Array
                </h3>
                <span className="text-xs text-slate-500">
                  Head-of-Line (Rank #1) departs first based on terminal arrival timestamp.
                </span>
              </div>
              <span className="text-xs font-mono font-bold bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200">
                {queuedEntries.length} Vehicles Waiting
              </span>
            </div>

            {queuedEntries.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-bold text-slate-600">No vehicles in queue</p>
                <p className="text-xs">Enroll an arriving vehicle on the left to start the FIFO line.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queuedEntries.map((entry) => {
                  const vehicle = state.vehicles.find((v) => v.id === entry.vehicleId);
                  const driver = state.drivers.find((d) => d.id === entry.driverId);
                  const route = state.routes.find((r) => r.id === entry.targetRouteId);
                  const isHeadOfLine = entry.queuePosition === 1;

                  return (
                    <div
                      key={entry.id}
                      className={`p-4 rounded-xl border transition flex items-center justify-between ${
                        isHeadOfLine
                          ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-500/20 shadow-sm'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                            isHeadOfLine
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          #{entry.queuePosition}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 font-mono">
                              {vehicle?.licensePlate}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              Side #{vehicle?.sideNumber} • {vehicle?.level}
                            </span>
                            {isHeadOfLine && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse">
                                ★ HEAD OF LINE
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Driver: <span className="font-semibold text-slate-700">{driver?.fullName}</span> • Target: <span className="font-semibold text-slate-700">{route?.id}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <span className="text-slate-400 block text-[10px]">Arrival Timestamp:</span>
                        <span className="font-mono text-slate-600">
                          {new Date(entry.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FLEET INVENTORY MANAGEMENT */}
      {activeTab === 'fleet' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Registered Transport Fleets & Drivers
              </h2>
              <span className="text-xs text-slate-500">
                Semen Wolo Transport Logistics Association Directory
              </span>
            </div>
            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Vehicle Profile</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">License Plate</th>
                  <th className="p-3">Side No</th>
                  <th className="p-3">Level Tier</th>
                  <th className="p-3">Seat Blueprint</th>
                  <th className="p-3">Assigned Driver</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.vehicles.map((veh) => {
                  const driver = state.drivers.find((d) => d.id === veh.assignedDriverId);
                  return (
                    <tr key={veh.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{veh.licensePlate}</td>
                      <td className="p-3 font-mono text-slate-600">{veh.sideNumber}</td>
                      <td className="p-3 font-semibold text-slate-800">
                        {VEHICLE_CONFIGS[veh.level].name}
                      </td>
                      <td className="p-3 text-slate-600">{veh.totalCapacity} Seats</td>
                      <td className="p-3 font-medium text-slate-800">
                        {driver ? `${driver.fullName} (${driver.licenseNumber})` : 'Unassigned'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            veh.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : veh.status === 'IN_QUEUE'
                              ? 'bg-purple-100 text-purple-800'
                              : veh.status === 'MAINTENANCE'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {veh.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: EMERGENCY FLEET BREAKDOWN & STANDBY SUBSTITUTION */}
      {activeTab === 'breakdown' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Emergency Fleet Breakdown & Standby Substitution Workbench
              </h2>
              <p className="text-xs text-slate-500">
                Quickly swap a malfunctioning vehicle with an idle standby vehicle from the association, preserving all booked seat reservations.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubstitute} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Affected Trip Voyage
              </label>
              <select
                value={breakdownTripId}
                onChange={(e) => setBreakdownTripId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs"
              >
                {state.trips.map((tr) => {
                  const veh = state.vehicles.find((v) => v.id === tr.vehicleId);
                  return (
                    <option key={tr.id} value={tr.id}>
                      Trip #{tr.id} • Vehicle: {veh?.licensePlate} ({veh?.totalCapacity} seats)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Idle Standby Vehicle (Must have equal or greater capacity)
              </label>
              <select
                value={replacementVehicleId}
                onChange={(e) => setReplacementVehicleId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono font-bold"
              >
                {state.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.licensePlate} (Side #{v.sideNumber} - {v.totalCapacity} Seats, {v.level}) - {v.status}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <span className="font-bold block">Automated Manifest Remapping Protocol:</span>
              <p>
                All existing passenger seats are transferred without loss. The broken vehicle is flagged as MAINTENANCE and automated SMS alerts are dispatched to all booked travelers.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Execute Emergency Fleet Substitution</span>
            </button>
          </form>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Add New Fleet Profile</h3>
            <form onSubmit={handleAddVehicle} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">License Plate Number</label>
                <input
                  type="text"
                  placeholder="e.g. 3-89412 AA"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Side Tracking Number</label>
                <input
                  type="text"
                  placeholder="e.g. 704"
                  value={newSideNumber}
                  onChange={(e) => setNewSideNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Vehicle Classification Level</label>
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value as VehicleLevel)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                >
                  <option value="LEVEL_1">Level 1 (45 Seats - Luxury Coach)</option>
                  <option value="LEVEL_2">Level 2 (60 Seats - Standard)</option>
                  <option value="LEVEL_3">Level 3 (60 Seats - Economy)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Assigned Driver</label>
                <select
                  value={newDriverId}
                  onChange={(e) => setNewDriverId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                >
                  {state.drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.licenseNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg transition"
                >
                  Save Vehicle Profile
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
