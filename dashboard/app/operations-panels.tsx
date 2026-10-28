'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Route, Vehicle, VehicleLevel, Driver } from '../../src/types';
import { VEHICLE_CONFIGS } from '../../src/services/tariffEngine';
import { useTransportState } from './transport-state';

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const buttonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800';
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50';

function PanelHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function RouteManagementPanel() {
  const { state, setState } = useTransportState();
  const [editingId, setEditingId] = useState('');
  const [originTerminalId, setOriginTerminalId] = useState('');
  const [destinationTerminalId, setDestinationTerminalId] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [stops, setStops] = useState('');
  const [notice, setNotice] = useState('');

  const linkedRouteIds = useMemo(
    () => new Set(state.trips.map((trip) => trip.routeId)),
    [state.trips],
  );

  function resetForm() {
    setEditingId('');
    setOriginTerminalId('');
    setDestinationTerminalId('');
    setDistanceKm('');
    setStops('');
  }

  function editRoute(route: Route) {
    setEditingId(route.id);
    setOriginTerminalId(route.originTerminalId);
    setDestinationTerminalId(route.destinationTerminalId);
    setDistanceKm(String(route.distanceKm));
    setStops(route.stops.join(', '));
    setNotice('');
  }

  function saveRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const distance = Number(distanceKm);
    if (!originTerminalId || !destinationTerminalId || originTerminalId === destinationTerminalId) {
      setNotice('Select two different terminals.');
      return;
    }
    if (!Number.isFinite(distance) || distance <= 0) {
      setNotice('Distance must be a positive number.');
      return;
    }
    const duplicate = state.routes.some(
      (route) =>
        route.id !== editingId &&
        route.originTerminalId === originTerminalId &&
        route.destinationTerminalId === destinationTerminalId,
    );
    if (duplicate) {
      setNotice('This origin and destination route already exists.');
      return;
    }
    if (editingId && linkedRouteIds.has(editingId)) {
      setNotice('This route is used by a scheduled trip and cannot be edited.');
      return;
    }

    const route: Route = {
      id: editingId || `route-${Date.now()}`,
      originTerminalId,
      destinationTerminalId,
      distanceKm: distance,
      stops: stops.split(',').map((stop) => stop.trim()).filter(Boolean),
      baseRatePerKm: state.globalTariffRatePerKm,
    };
    setState((previous) => ({
      ...previous,
      routes: editingId
        ? previous.routes.map((item) => (item.id === editingId ? route : item))
        : [...previous.routes, route],
    }));
    setNotice(editingId ? 'Route updated.' : 'Route added.');
    resetForm();
  }

  function deleteRoute(routeId: string) {
    if (linkedRouteIds.has(routeId)) {
      setNotice('Routes assigned to scheduled trips cannot be deleted.');
      return;
    }
    setState((previous) => ({
      ...previous,
      routes: previous.routes.filter((route) => route.id !== routeId),
    }));
    if (editingId === routeId) resetForm();
    setNotice('Route deleted.');
  }

  const terminalName = (id: string) => state.terminals.find((terminal) => terminal.id === id)?.name ?? id;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <PanelHeading title="Global route directory" description="Create and maintain terminal-to-terminal routes. Routes referenced by schedules are protected from edits and deletion." />
      {notice && <p role="status" className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{notice}</p>}
      <form onSubmit={saveRoute} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <select className={fieldClass} value={originTerminalId} onChange={(event) => setOriginTerminalId(event.target.value)} required>
          <option value="">Origin terminal</option>
          {state.terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}
        </select>
        <select className={fieldClass} value={destinationTerminalId} onChange={(event) => setDestinationTerminalId(event.target.value)} required>
          <option value="">Destination terminal</option>
          {state.terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}
        </select>
        <input className={fieldClass} type="number" min="1" step="0.1" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} placeholder="Distance (km)" required />
        <input className={fieldClass} value={stops} onChange={(event) => setStops(event.target.value)} placeholder="Stops, comma separated" />
        <div className="flex gap-2">
          <button className={buttonClass} type="submit"><Plus size={15} />{editingId ? 'Save route' : 'Add route'}</button>
          {editingId && <button className={secondaryButtonClass} type="button" onClick={resetForm}><X size={15} />Cancel</button>}
        </div>
      </form>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="py-2">Route</th><th>Distance</th><th>Stops</th><th>Schedule status</th><th className="text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {state.routes.map((route) => (
              <tr key={route.id}>
                <td className="py-3 font-semibold text-slate-800">{terminalName(route.originTerminalId)} → {terminalName(route.destinationTerminalId)}</td>
                <td>{route.distanceKm} km</td><td className="text-slate-600">{route.stops.join(', ') || '—'}</td>
                <td>{linkedRouteIds.has(route.id) ? 'In use' : 'Available'}</td>
                <td className="text-right">
                  <button className="mr-2 rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" disabled={linkedRouteIds.has(route.id)} onClick={() => editRoute(route)} aria-label="Edit route"><Pencil size={15} /></button>
                  <button className="rounded p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-30" disabled={linkedRouteIds.has(route.id)} onClick={() => deleteRoute(route.id)} aria-label="Delete route"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FleetManagementPanel() {
  const { state, setState } = useTransportState();
  const associationId = state.vehicles[0]?.associationId ?? state.associations[0]?.id ?? '';
  const [editingVehicleId, setEditingVehicleId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [sideNumber, setSideNumber] = useState('');
  const [level, setLevel] = useState<VehicleLevel>('LEVEL_2');
  const [assignedDriverId, setAssignedDriverId] = useState('');
  const [editingDriverId, setEditingDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [notice, setNotice] = useState('');

  const vehicleHasTrip = (id: string) => state.trips.some((trip) => trip.vehicleId === id);
  const driverHasTrip = (id: string) => state.trips.some((trip) => trip.driverId === id);

  function clearVehicle() {
    setEditingVehicleId('');
    setPlateNumber('');
    setSideNumber('');
    setLevel('LEVEL_2');
    setAssignedDriverId('');
  }

  function submitVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const duplicate = state.vehicles.some(
      (vehicle) => vehicle.id !== editingVehicleId && vehicle.licensePlate.toLowerCase() === plateNumber.trim().toLowerCase(),
    );
    if (duplicate) {
      setNotice('A bus with this license plate already exists.');
      return;
    }
    if (editingVehicleId && vehicleHasTrip(editingVehicleId)) {
      setNotice('A bus assigned to a scheduled trip cannot be edited.');
      return;
    }
    const vehicle: Vehicle = {
      id: editingVehicleId || `vehicle-${Date.now()}`,
      licensePlate: plateNumber.trim().toUpperCase(),
      sideNumber: sideNumber.trim(),
      level,
      totalCapacity: VEHICLE_CONFIGS[level].defaultCapacity,
      associationId,
      assignedDriverId: assignedDriverId || undefined,
      status: editingVehicleId
        ? state.vehicles.find((item) => item.id === editingVehicleId)?.status ?? 'ACTIVE'
        : 'ACTIVE',
    };
    setState((previous) => ({
      ...previous,
      vehicles: editingVehicleId
        ? previous.vehicles.map((item) => (item.id === editingVehicleId ? vehicle : item))
        : [...previous.vehicles, vehicle],
    }));
    setNotice(editingVehicleId ? 'Bus profile updated.' : 'Bus added to fleet.');
    clearVehicle();
  }

  function clearDriver() {
    setEditingDriverId('');
    setDriverName('');
    setDriverPhone('');
    setLicenseNumber('');
  }

  function submitDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const duplicate = state.drivers.some(
      (driver) => driver.id !== editingDriverId && (driver.phone === driverPhone.trim() || driver.licenseNumber.toLowerCase() === licenseNumber.trim().toLowerCase()),
    );
    if (duplicate) {
      setNotice('Driver phone number and license number must be unique.');
      return;
    }
    if (editingDriverId && driverHasTrip(editingDriverId)) {
      setNotice('A driver assigned to a scheduled trip cannot be edited.');
      return;
    }
    const driver: Driver = {
      id: editingDriverId || `driver-${Date.now()}`,
      userId: state.drivers.find((item) => item.id === editingDriverId)?.userId ?? `user-${Date.now()}`,
      fullName: driverName.trim(),
      phone: driverPhone.trim(),
      licenseNumber: licenseNumber.trim().toUpperCase(),
      associationId,
      dutyStatus: state.drivers.find((item) => item.id === editingDriverId)?.dutyStatus ?? 'ACTIVE',
    };
    setState((previous) => ({
      ...previous,
      drivers: editingDriverId
        ? previous.drivers.map((item) => (item.id === editingDriverId ? driver : item))
        : [...previous.drivers, driver],
    }));
    setNotice(editingDriverId ? 'Driver profile updated.' : 'Driver added to roster.');
    clearDriver();
  }

  function removeVehicle(id: string) {
    if (vehicleHasTrip(id) || state.fifoQueues.some((entry) => entry.vehicleId === id && entry.status === 'QUEUED')) {
      setNotice('A bus assigned to a trip or active queue cannot be removed.');
      return;
    }
    setState((previous) => ({
      ...previous,
      vehicles: previous.vehicles.filter((vehicle) => vehicle.id !== id),
    }));
    setNotice('Bus removed from the local fleet roster.');
  }

  function removeDriver(id: string) {
    if (driverHasTrip(id) || state.vehicles.some((vehicle) => vehicle.assignedDriverId === id)) {
      setNotice('A driver assigned to a bus or trip cannot be removed.');
      return;
    }
    setState((previous) => ({
      ...previous,
      drivers: previous.drivers.filter((driver) => driver.id !== id),
    }));
    setNotice('Driver removed from the local roster.');
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <PanelHeading title="Fleet and driver roster" description="Create, update, and remove bus and driver profiles. Active trips and assigned resources are protected from destructive changes." />
      {notice && <p role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{notice}</p>}
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 font-bold text-slate-800">Buses</h3>
          <form onSubmit={submitVehicle} className="grid gap-2 sm:grid-cols-2">
            <input className={fieldClass} value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} placeholder="License plate" required />
            <input className={fieldClass} value={sideNumber} onChange={(event) => setSideNumber(event.target.value)} placeholder="Side number" required />
            <select className={fieldClass} value={level} onChange={(event) => setLevel(event.target.value as VehicleLevel)}>
              <option value="LEVEL_1">Level 1</option><option value="LEVEL_2">Level 2</option><option value="LEVEL_3">Level 3</option>
            </select>
            <select className={fieldClass} value={assignedDriverId} onChange={(event) => setAssignedDriverId(event.target.value)}>
              <option value="">No assigned driver</option>
              {state.drivers.filter((driver) => driver.associationId === associationId).map((driver) => <option key={driver.id} value={driver.id}>{driver.fullName}</option>)}
            </select>
            <div className="flex gap-2 sm:col-span-2">
              <button className={buttonClass}><Plus size={15} />{editingVehicleId ? 'Save bus' : 'Add bus'}</button>
              {editingVehicleId && <button className={secondaryButtonClass} type="button" onClick={clearVehicle}>Cancel</button>}
            </div>
          </form>
          <div className="mt-4 space-y-2">
            {state.vehicles.filter((vehicle) => vehicle.associationId === associationId).map((vehicle) => (
              <div key={vehicle.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div><p className="font-semibold text-slate-800">{vehicle.licensePlate} · #{vehicle.sideNumber}</p><p className="text-xs text-slate-500">{vehicle.level.replace('_', ' ')} · {vehicle.totalCapacity} seats · {state.drivers.find((driver) => driver.id === vehicle.assignedDriverId)?.fullName ?? 'Driver unassigned'}</p></div>
                <div className="flex shrink-0 gap-1">
                  <button className="rounded p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" disabled={vehicleHasTrip(vehicle.id)} onClick={() => { setEditingVehicleId(vehicle.id); setPlateNumber(vehicle.licensePlate); setSideNumber(vehicle.sideNumber); setLevel(vehicle.level); setAssignedDriverId(vehicle.assignedDriverId ?? ''); }} aria-label="Edit bus"><Pencil size={15} /></button>
                  <button className="rounded p-2 text-rose-700 hover:bg-rose-50" onClick={() => removeVehicle(vehicle.id)} aria-label="Delete bus"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-bold text-slate-800">Drivers</h3>
          <form onSubmit={submitDriver} className="grid gap-2 sm:grid-cols-2">
            <input className={fieldClass} value={driverName} onChange={(event) => setDriverName(event.target.value)} placeholder="Full name" required />
            <input className={fieldClass} value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)} placeholder="Phone" required />
            <input className={fieldClass} value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} placeholder="License number" required />
            <div className="flex gap-2">
              <button className={buttonClass}><Plus size={15} />{editingDriverId ? 'Save driver' : 'Add driver'}</button>
              {editingDriverId && <button className={secondaryButtonClass} type="button" onClick={clearDriver}>Cancel</button>}
            </div>
          </form>
          <div className="mt-4 space-y-2">
            {state.drivers.filter((driver) => driver.associationId === associationId).map((driver) => (
              <div key={driver.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div><p className="font-semibold text-slate-800">{driver.fullName}</p><p className="text-xs text-slate-500">{driver.phone} · License {driver.licenseNumber} · {driver.dutyStatus.replace('_', ' ')}</p></div>
                <div className="flex shrink-0 gap-1">
                  <button className="rounded p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" disabled={driverHasTrip(driver.id)} onClick={() => { setEditingDriverId(driver.id); setDriverName(driver.fullName); setDriverPhone(driver.phone); setLicenseNumber(driver.licenseNumber); }} aria-label="Edit driver"><Pencil size={15} /></button>
                  <button className="rounded p-2 text-rose-700 hover:bg-rose-50" onClick={() => removeDriver(driver.id)} aria-label="Delete driver"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
