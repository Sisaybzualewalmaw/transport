/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AppState,
  TerminalStation,
  TransportAssociation,
  User,
  UserRole,
} from '../types';
import { Locale, TRANSLATIONS } from '../utils/translations';
import { updateGlobalTariffAndCascadePrices } from '../services/dispatchService';
import { computeFinancialSummary } from '../store/transportStore';
import {
  Coins,
  FileSpreadsheet,
  Building,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  RefreshCw,
  Landmark,
  MapPin,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

interface AdminPortalProps {
  currentUser: User;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  locale: Locale;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  state,
  setState,
  locale,
}) => {
  const t = TRANSLATIONS[locale];

  const [activeTab, setActiveTab] = useState<
    'tariff' | 'finance' | 'terminals' | 'analytics' | 'associations' | 'users' | 'audit'
  >('tariff');

  // Dynamic Tariff Configuration state
  const [newTariffRate, setNewTariffRate] = useState<number>(state.globalTariffRatePerKm);

  // Association Onboarding state
  const [showAddAssocModal, setShowAddAssocModal] = useState<boolean>(false);
  const [assocName, setAssocName] = useState<string>('');
  const [assocLicense, setAssocLicense] = useState<string>('');
  const [assocHub, setAssocHub] = useState<string>('');
  const [assocPhone, setAssocPhone] = useState<string>('033');

  // Terminal Station Management state (UC-24)
  const [showAddTerminalModal, setShowAddTerminalModal] = useState<boolean>(false);
  const [termName, setTermName] = useState<string>('');
  const [termNameAmharic, setTermNameAmharic] = useState<string>('');
  const [termRegion, setTermRegion] = useState<string>('');
  const [termBayCapacity, setTermBayCapacity] = useState<number>(50);

  const [adminAlert, setAdminAlert] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const financialSummary = computeFinancialSummary(state);

  // Handle Dynamic Tariff Update with Cascading Price Recalculation
  const handleApplyTariff = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTariffRate <= 0) {
      setAdminAlert({ type: 'error', text: 'Tariff Out of Acceptable Bounds: Rate must be greater than zero.' });
      return;
    }

    const { updatedState, tripsUpdated, message } = updateGlobalTariffAndCascadePrices(
      state,
      Number(newTariffRate),
      currentUser.name
    );

    setState(updatedState);
    setAdminAlert({
      type: 'success',
      text: `${message} (${tripsUpdated} upcoming national routes synchronized).`,
    });
  };

  // Handle Association Onboarding (UC-09)
  const handleOnboardAssociation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assocName.trim() || !assocLicense.trim()) {
      setAdminAlert({ type: 'error', text: 'Association Name and Business License ID are mandatory.' });
      return;
    }

    if (state.associations.some((a) => a.licenseNumber.toLowerCase() === assocLicense.trim().toLowerCase())) {
      setAdminAlert({ type: 'error', text: 'Onboarding Blocked: Dual registration detected for this License ID.' });
      return;
    }

    const newAssoc: TransportAssociation = {
      id: `assoc-${Date.now()}`,
      name: assocName.trim(),
      licenseNumber: assocLicense.trim(),
      regionalOfficeHub: assocHub.trim() || 'Woldia Regional Hub',
      liaisonPhone: assocPhone.trim(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    const updated = {
      ...state,
      associations: [...state.associations, newAssoc],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: currentUser.phone,
          userName: currentUser.name,
          role: 'SYSTEM_ADMIN' as const,
          action: 'ASSOCIATION_ONBOARDED',
          details: `Transport Association '${newAssoc.name}' (License: ${newAssoc.licenseNumber}) officially onboarded by ETA.`,
        },
        ...state.auditLogs,
      ],
    };

    setState(updated);
    setShowAddAssocModal(false);
    setAssocName('');
    setAssocLicense('');
    setAssocHub('');
    setAdminAlert({
      type: 'success',
      text: `Association '${newAssoc.name}' onboarded and provisioned successfully.`,
    });
  };

  // Handle Terminal Station Management (UC-24)
  const handleAddTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termName.trim()) {
      setAdminAlert({ type: 'error', text: 'Terminal name is required.' });
      return;
    }

    if (state.terminals.some((t) => t.name.toLowerCase() === termName.trim().toLowerCase())) {
      setAdminAlert({ type: 'error', text: 'Terminal name already exists in directory.' });
      return;
    }

    const newTerm: TerminalStation = {
      id: `term-${Date.now()}`,
      name: termName.trim(),
      nameAmharic: termNameAmharic.trim() || termName.trim(),
      region: termRegion.trim() || 'Amhara',
      bayCapacity: termBayCapacity,
      status: 'ACTIVE',
    };

    const updated = {
      ...state,
      terminals: [...state.terminals, newTerm],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: currentUser.phone,
          userName: currentUser.name,
          role: 'SYSTEM_ADMIN' as const,
          action: 'TERMINAL_STATION_CREATED',
          details: `New physical terminal node '${newTerm.name}' (${newTerm.bayCapacity} bays) registered by ETA.`,
        },
        ...state.auditLogs,
      ],
    };

    setState(updated);
    setShowAddTerminalModal(false);
    setTermName('');
    setTermNameAmharic('');
    setTermRegion('');
    setAdminAlert({
      type: 'success',
      text: `Terminal Station '${newTerm.name}' registered successfully.`,
    });
  };

  // Toggle user active/suspended state with Self-Demotion Block (UC-05 Alt Flow 1)
  const handleToggleUserStatus = (userId: string) => {
    const userToEdit = state.users.find((u) => u.id === userId);
    if (!userToEdit) return;

    if (userToEdit.id === currentUser.id) {
      setAdminAlert({
        type: 'error',
        text: 'Operation Denied: Administrative self-modification / suspension prohibited.',
      });
      return;
    }

    const newStatus = userToEdit.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    userToEdit.status = newStatus;

    const updated = {
      ...state,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: currentUser.phone,
          userName: currentUser.name,
          role: 'SYSTEM_ADMIN' as const,
          action: 'USER_STATUS_MODIFIED',
          details: `User ${userToEdit.name} (${userToEdit.phone}) status toggled to ${newStatus}.`,
        },
        ...state.auditLogs,
      ],
    };

    setState(updated);
    setAdminAlert({
      type: 'success',
      text: `User ${userToEdit.name} marked as ${newStatus}.`,
    });
  };

  // Export Financial Spreadsheet to CSV (FR-REP-01, UC-20)
  const handleExportCSV = () => {
    const headers =
      'Ticket Number,Trip ID,Passenger,Phone,Fare (ETB),5% Terminal Fee (ETB),95% Operator Share (ETB),Payment Method,Status,Date\n';
    const rows = state.tickets
      .map(
        (tkt) =>
          `"${tkt.ticketNumber}","${tkt.tripId}","${tkt.passengerName}","${tkt.passengerPhone}",${tkt.fareAmount},${tkt.terminalFeeShare},${tkt.operatorShare},"${tkt.paymentMethod}","${tkt.status}","${tkt.issuedAt}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ETA_Woldia_Financial_Reconciliation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-rose-900/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
            <Landmark className="w-4 h-4" />
            <span>Ethiopian Transport Authority (ETA) • National Oversight</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Central Regulatory Administration Command Center
          </h1>
          <p className="text-slate-300 text-xs mt-1">
            Dynamic nationwide tariff engine, 5%/95% automated financial splits, association licensing, terminals, and unalterable audit trails.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('tariff')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tariff' ? 'bg-rose-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Tariff Engine</span>
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'finance' ? 'bg-rose-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>5% / 95% Financials</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'analytics' ? 'bg-rose-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Traffic Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('terminals')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'terminals' ? 'bg-rose-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Stations</span>
          </button>
          <button
            onClick={() => setActiveTab('associations')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'associations' ? 'bg-rose-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Associations</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'users' ? 'bg-rose-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>RBAC Users</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'bg-rose-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Audit Ledger</span>
          </button>
        </div>
      </div>

      {adminAlert && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            adminAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-rose-50 text-rose-800 border border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {adminAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{adminAlert.text}</span>
          </div>
          <button onClick={() => setAdminAlert(null)} className="cursor-pointer font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: CENTRAL DYNAMIC TARIFF ENGINE */}
      {activeTab === 'tariff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-1 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
              <Coins className="w-4 h-4 text-rose-700" />
              <span>Modify National Baseline Tariff</span>
            </h2>

            <form onSubmit={handleApplyTariff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Active Baseline Rate (ETB / km)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    max="10.00"
                    value={newTariffRate}
                    onChange={(e) => setNewTariffRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-lg font-black text-slate-900 font-mono"
                  />
                  <span className="absolute right-4 top-3.5 text-xs text-slate-400 font-bold">
                    ETB / KM
                  </span>
                </div>
                <span className="block text-[11px] text-slate-500 mt-1">
                  Current Official Rate: <span className="font-bold text-slate-800">{state.globalTariffRatePerKm} ETB/km</span>
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <span className="font-bold text-slate-800 block">Cascading Recalculation Rule:</span>
                <p>
                  Saving will immediately trigger an automated sweep of all upcoming scheduled voyages across Ethiopia, recalculating passenger fares based on:
                </p>
                <p className="font-mono text-[11px] text-slate-800 bg-white p-2 rounded border border-slate-200">
                  Fare = (Distance × BaseRate × LevelModifier) + 10 ETB
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-rose-700 hover:bg-rose-800 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t.applyTariff}</span>
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-2 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 border-b border-slate-200 pb-3">
              National Active Route Fares (Under Active Tariff: {state.globalTariffRatePerKm} ETB/km)
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-3">Route Path</th>
                    <th className="p-3">Distance</th>
                    <th className="p-3">Level 1 (x1.30)</th>
                    <th className="p-3">Level 2 (x1.15)</th>
                    <th className="p-3">Level 3 (x1.00)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.routes.map((rt) => {
                    const orig = state.terminals.find((t) => t.id === rt.originTerminalId);
                    const dest = state.terminals.find((t) => t.id === rt.destinationTerminalId);
                    const l1Fare = (rt.distanceKm * state.globalTariffRatePerKm * 1.30 + 10).toFixed(2);
                    const l2Fare = (rt.distanceKm * state.globalTariffRatePerKm * 1.15 + 10).toFixed(2);
                    const l3Fare = (rt.distanceKm * state.globalTariffRatePerKm * 1.00 + 10).toFixed(2);

                    return (
                      <tr key={rt.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">
                          {orig?.name.split(' ')[0]} ➔ {dest?.name.split(' ')[0]}
                        </td>
                        <td className="p-3 font-mono text-slate-600">{rt.distanceKm} km</td>
                        <td className="p-3 font-bold text-emerald-700">{l1Fare} ETB</td>
                        <td className="p-3 font-bold text-blue-700">{l2Fare} ETB</td>
                        <td className="p-3 font-bold text-slate-700">{l3Fare} ETB</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL RECONCILIATION */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-bold uppercase">{t.totalGrossRevenue}</span>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {financialSummary.totalGrossRevenue.toFixed(2)} ETB
              </div>
              <span className="text-[11px] text-slate-400">Total collected fares</span>
            </div>

            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
              <span className="text-xs text-emerald-800 font-bold uppercase">{t.terminalShare5}</span>
              <div className="text-2xl font-black text-emerald-950 mt-2">
                {financialSummary.totalTerminalFees.toFixed(2)} ETB
              </div>
              <span className="text-[11px] text-emerald-700">Woldia Station operational pool</span>
            </div>

            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm">
              <span className="text-xs text-amber-800 font-bold uppercase">{t.operatorShare95}</span>
              <div className="text-2xl font-black text-amber-950 mt-2">
                {financialSummary.totalOperatorDisbursements.toFixed(2)} ETB
              </div>
              <span className="text-[11px] text-amber-700">Vehicle owners / associations balance</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-bold uppercase">Volume Settled</span>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {financialSummary.totalTicketsSold} Tickets
              </div>
              <span className="text-[11px] text-slate-400">
                {financialSummary.totalCancellations} cancellations refunded
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Detailed Transactional Settlement Ledger
                </h3>
                <span className="text-xs text-slate-500">
                  Itemized split calculation per ticket (PRD Section 4.7.1)
                </span>
              </div>
              <button
                onClick={handleExportCSV}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Report</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-3">Ticket No</th>
                    <th className="p-3">Passenger</th>
                    <th className="p-3">Total Fare</th>
                    <th className="p-3">5% Terminal Fee</th>
                    <th className="p-3">95% Operator Share</th>
                    <th className="p-3">Channel</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.tickets.map((tkt) => (
                    <tr key={tkt.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold">{tkt.ticketNumber}</td>
                      <td className="p-3 font-semibold">{tkt.passengerName}</td>
                      <td className="p-3 font-bold text-slate-900">{tkt.fareAmount.toFixed(2)} ETB</td>
                      <td className="p-3 font-bold text-emerald-700">{tkt.terminalFeeShare.toFixed(2)} ETB</td>
                      <td className="p-3 font-bold text-amber-700">{tkt.operatorShare.toFixed(2)} ETB</td>
                      <td className="p-3 uppercase font-medium">{tkt.paymentMethod}</td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tkt.status === 'CHECKED_IN'
                              ? 'bg-blue-100 text-blue-800'
                              : tkt.status === 'CANCELLED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {tkt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRAFFIC & OPERATIONAL ANALYTICS (FR-REP-02) */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <BarChart3 className="w-5 h-5 text-rose-700" />
              <h2 className="font-extrabold text-base text-slate-900">
                National Corridor Throughput & Fleet Load Factors (FR-REP-02)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {state.routes.map((rt) => {
                const orig = state.terminals.find((t) => t.id === rt.originTerminalId);
                const dest = state.terminals.find((t) => t.id === rt.destinationTerminalId);
                const routeTrips = state.trips.filter((tr) => tr.routeId === rt.id);
                const routeTickets = state.tickets.filter((tkt) =>
                  routeTrips.some((tr) => tr.id === tkt.tripId && tkt.status !== 'CANCELLED')
                );

                return (
                  <div key={rt.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {orig?.name.split(' ')[0]} ➔ {dest?.name.split(' ')[0]}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                        {rt.distanceKm} km
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <div>Active Scheduled Trips: <span className="font-bold text-slate-800">{routeTrips.length}</span></div>
                      <div>Passengers Booked: <span className="font-bold text-emerald-700">{routeTickets.length} travelers</span></div>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(15, routeTickets.length * 20))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TERMINAL STATIONS MANAGEMENT (UC-24) */}
      {activeTab === 'terminals' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Physical Terminal Stations & Node Management (UC-24)
              </h2>
              <span className="text-xs text-slate-500">
                Official departure hubs, bay capacities, and regional nodes
              </span>
            </div>
            <button
              onClick={() => setShowAddTerminalModal(true)}
              className="bg-rose-700 hover:bg-rose-800 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Terminal Node</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.terminals.map((term) => (
              <div key={term.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{term.name}</h3>
                    <span className="text-xs text-slate-500">{term.nameAmharic}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {term.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Region: <span className="font-semibold text-slate-800">{term.region}</span></div>
                  <div>Vehicle Bay Capacity: <span className="font-bold text-slate-800">{term.bayCapacity} Bays</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: TRANSPORT ASSOCIATIONS */}
      {activeTab === 'associations' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Certified Transport Associations Directory (UC-09)
              </h2>
              <span className="text-xs text-slate-500">
                Official licensing and operational boundaries
              </span>
            </div>
            <button
              onClick={() => setShowAddAssocModal(true)}
              className="bg-rose-700 hover:bg-rose-800 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Onboard New Association</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.associations.map((assoc) => (
              <div key={assoc.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">{assoc.name}</h3>
                    <span className="text-[11px] font-mono text-slate-500">
                      License: {assoc.licenseNumber}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {assoc.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Regional Hub: <span className="font-semibold text-slate-800">{assoc.regionalOfficeHub}</span></div>
                  <div>Liaison Phone: <span className="font-mono text-slate-800">{assoc.liaisonPhone}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: RBAC USERS (UC-05) */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Role-Based Access Control (RBAC) Master Directory (UC-05)
              </h2>
              <span className="text-xs text-slate-500">
                System identity verification and role assignment
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Phone (Identifier)</th>
                  <th className="p-3">Operational Role</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.users.map((usr) => (
                  <tr key={usr.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{usr.name}</td>
                    <td className="p-3 font-mono text-slate-700">{usr.phone}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                        {usr.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          usr.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {usr.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggleUserStatus(usr.id)}
                        disabled={usr.id === currentUser.id}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {usr.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: IMMUTABLE AUDIT LEDGER */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Immutable System Audit Ledger (PRD Section 3.3.14)
              </h2>
              <span className="text-xs text-slate-500">
                Cryptographically tracked log of all seat overrides, tariff modifications, cancellations, and check-ins.
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 px-3 py-1 rounded-full">
              {state.auditLogs.length} Events Logged
            </span>
          </div>

          <div className="space-y-2">
            {state.auditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-mono font-bold text-slate-600">{log.action}</span>
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-slate-800 font-medium">{log.details}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Triggered by: <span className="font-bold text-slate-700">{log.userName}</span> ({log.role})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onboard Association Modal */}
      {showAddAssocModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Onboard Transport Association</h3>
            <form onSubmit={handleOnboardAssociation} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Association Official Name</label>
                <input
                  type="text"
                  placeholder="e.g. Abay Transport Association"
                  value={assocName}
                  onChange={(e) => setAssocName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Business License Reference ID</label>
                <input
                  type="text"
                  placeholder="e.g. ETA-LIC-088/20-112"
                  value={assocLicense}
                  onChange={(e) => setAssocLicense(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Regional Office Hub</label>
                <input
                  type="text"
                  placeholder="e.g. Woldia Terminal Platform 2"
                  value={assocHub}
                  onChange={(e) => setAssocHub(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Primary Liaison Phone</label>
                <input
                  type="text"
                  value={assocPhone}
                  onChange={(e) => setAssocPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-rose-700 hover:bg-rose-800 text-white font-bold py-2.5 rounded-lg transition"
                >
                  Onboard Association
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddAssocModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Terminal Station Modal (UC-24) */}
      {showAddTerminalModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Add New Terminal Station Node</h3>
            <form onSubmit={handleAddTerminal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Official Station Name</label>
                <input
                  type="text"
                  placeholder="e.g. Gondar Azezo Terminal"
                  value={termName}
                  onChange={(e) => setTermName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Amharic Name (ስም በአማርኛ)</label>
                <input
                  type="text"
                  placeholder="e.g. የጎንደር አዘዞ መነሀሪያ"
                  value={termNameAmharic}
                  onChange={(e) => setTermNameAmharic(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Regional Location</label>
                <input
                  type="text"
                  placeholder="e.g. Central Gondar"
                  value={termRegion}
                  onChange={(e) => setTermRegion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Vehicle Bay Capacity</label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={termBayCapacity}
                  onChange={(e) => setTermBayCapacity(parseInt(e.target.value) || 30)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-rose-700 hover:bg-rose-800 text-white font-bold py-2.5 rounded-lg transition"
                >
                  Save Station Node
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTerminalModal(false)}
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
