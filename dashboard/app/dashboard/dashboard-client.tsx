'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bus,
  ClipboardList,
  LogOut,
  Map,
  ShieldCheck,
  TicketCheck,
  Users,
} from 'lucide-react';
import { AdminPortal } from '../../../src/components/AdminPortal';
import { ClerkPortal } from '../../../src/components/ClerkPortal';
import { ManagerPortal } from '../../../src/components/ManagerPortal';
import { AppState, User, UserRole } from '../../../src/types';
import { computeFinancialSummary } from '../../../src/store/transportStore';
import { Locale } from '../../../src/utils/translations';
import type { DashboardUser } from '../../lib/auth';
import { FleetManagementPanel, RouteManagementPanel } from '../operations-panels';
import { TransportStateProvider, useTransportState } from '../transport-state';

type DashboardSection =
  | 'overview'
  | 'operations'
  | 'routes'
  | 'fleet'
  | 'walk-in'
  | 'verification';

const roleMap: Record<DashboardUser['role'], UserRole> = {
  PASSENGER: 'TRAVELER',
  TERMINAL_CLERK: 'TERMINAL_CLERK',
  ASSOCIATION_MANAGER: 'ASSOCIATE_MANAGER',
  ADMIN: 'SYSTEM_ADMIN',
};

const money = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  minimumFractionDigits: 2,
});

export function DashboardClient({ initialUser }: { initialUser: DashboardUser }) {
  return (
    <TransportStateProvider>
      <DashboardWorkspace initialUser={initialUser} />
    </TransportStateProvider>
  );
}

function DashboardWorkspace({ initialUser }: { initialUser: DashboardUser }) {
  const { state, setState } = useTransportState();
  const role = roleMap[initialUser.role];
  const [section, setSection] = useState<DashboardSection>('overview');
  const [locale] = useState<Locale>('en');
  const [signOutError, setSignOutError] = useState('');

  const currentUser: User = useMemo(
    () => ({
      id: initialUser.id,
      name: initialUser.fullName,
      phone: initialUser.phoneNumber,
      role,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    }),
    [initialUser, role],
  );

  const menu = useMemo(() => {
    const items: { id: DashboardSection; label: string; icon: typeof Activity }[] = [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
    ];
    if (role === 'SYSTEM_ADMIN') {
      items.push(
        { id: 'operations', label: 'Tariffs & analytics', icon: Activity },
        { id: 'routes', label: 'Global routes', icon: Map },
      );
    } else if (role === 'ASSOCIATE_MANAGER') {
      items.push(
        { id: 'operations', label: 'Rotation schedules', icon: ClipboardList },
        { id: 'fleet', label: 'Fleet & drivers', icon: Bus },
      );
    } else {
      items.push(
        { id: 'walk-in', label: 'Walk-in tickets', icon: TicketCheck },
        { id: 'verification', label: 'Gate verification', icon: ShieldCheck },
      );
    }
    return items;
  }, [role]);

  async function signOut() {
    setSignOutError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to clear the dashboard session.');
      window.location.assign('/login');
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : 'Sign-out failed.');
    }
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="flex w-full flex-col bg-slate-950 text-slate-100 lg:fixed lg:inset-y-0 lg:w-64">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <span className="rounded-xl bg-emerald-600 p-2.5"><Bus size={19} /></span>
          <div><p className="font-extrabold tracking-wide">ET-Trans</p><p className="text-xs text-slate-400">Operations</p></div>
        </div>
        <nav aria-label="Dashboard navigation" className="flex gap-1 overflow-x-auto p-3 lg:flex-1 lg:flex-col">
          {menu.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition lg:w-full ${
                section === id ? 'bg-emerald-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={17} />{label}
            </button>
          ))}
        </nav>
        <div className="hidden border-t border-slate-800 p-4 lg:block">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-sm font-bold">
              {initialUser.fullName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{initialUser.fullName}</p><p className="text-xs text-slate-400">{roleLabel(role)}</p></div>
          </div>
          <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-rose-950 hover:text-rose-200"><LogOut size={16} />Sign out</button>
          {signOutError && <p role="alert" className="mt-2 text-xs text-rose-300">{signOutError}</p>}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:ml-64 lg:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Transport scheduling & ticketing</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">{menu.find((item) => item.id === section)?.label ?? 'Dashboard'}</h1>
            <p className="mt-1 text-sm text-slate-500">Welcome, {initialUser.fullName}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            <Activity size={15} />Local demo workspace
          </div>
          <button onClick={signOut} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:hidden"><LogOut size={15} />Sign out</button>
        </div>
        {signOutError && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{signOutError}</p>}

        {section === 'overview' && <Overview state={state} role={role} onNavigate={setSection} />}
        {section === 'operations' && role === 'SYSTEM_ADMIN' && (
          <AdminPortal currentUser={currentUser} state={state} setState={setState} locale={locale} />
        )}
        {section === 'routes' && role === 'SYSTEM_ADMIN' && <RouteManagementPanel />}
        {section === 'operations' && role === 'ASSOCIATE_MANAGER' && (
          <>
            <ManagerPortal state={state} setState={setState} locale={locale} />
            <p className="mt-3 text-xs text-slate-500">Use the fleet and driver roster page for bus and driver CRUD.</p>
          </>
        )}
        {section === 'fleet' && role === 'ASSOCIATE_MANAGER' && <FleetManagementPanel />}
        {(section === 'walk-in' || section === 'verification') && role === 'TERMINAL_CLERK' && (
          <ClerkPortal
            key={section}
            currentUser={currentUser}
            state={state}
            setState={setState}
            locale={locale}
            initialTab={section === 'verification' ? 'gateScan' : 'walkIn'}
          />
        )}
      </main>
    </div>
  );
}

function Overview({
  state,
  role,
  onNavigate,
}: {
  state: AppState;
  role: UserRole;
  onNavigate: (section: DashboardSection) => void;
}) {
  const summary = computeFinancialSummary(state);
  const occupiedSeats = Object.values(state.seatInventories).flat().filter((seat) => seat.state === 'RESERVED' || seat.state === 'CHECKED_IN').length;
  const totalSeats = Object.values(state.seatInventories).flat().length;
  const metrics = [
    { label: 'Fleet vehicles', value: state.vehicles.length, icon: Bus },
    { label: 'Scheduled trips', value: state.trips.length, icon: ClipboardList },
    { label: 'Tickets sold', value: summary.totalTicketsSold, icon: TicketCheck },
    { label: 'Occupancy', value: `${totalSeats ? Math.round((occupiedSeats / totalSeats) * 100) : 0}%`, icon: Users },
  ];
  const actions: { title: string; detail: string; section: DashboardSection }[] =
    role === 'SYSTEM_ADMIN'
      ? [
          { title: 'Review tariffs & reports', detail: 'Set the price per km and inspect financial and traffic summaries.', section: 'operations' },
          { title: 'Manage route directory', detail: 'Add, update, or remove global routes.', section: 'routes' },
        ]
      : role === 'ASSOCIATE_MANAGER'
        ? [
            { title: 'Assign rotation schedules', detail: 'Manage the FIFO queue and create trips from the dispatch rotation.', section: 'operations' },
            { title: 'Manage fleet & drivers', detail: 'Maintain bus and driver profiles for your association.', section: 'fleet' },
          ]
        : [
            { title: 'Issue walk-in ticket', detail: 'Choose an available seat, take cash, and print a passenger ticket.', section: 'walk-in' },
            { title: 'Verify boarding pass', detail: 'Scan or enter a ticket code and check in the passenger.', section: 'verification' },
          ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon size={17} /></span></div>
            <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center gap-2"><BarChart3 size={18} className="text-emerald-700" /><h2 className="font-bold text-slate-900">Operational snapshot</h2></div>
          <p className="mt-1 text-xs text-slate-500">Values below are calculated from this browser&apos;s demo state, not the production database.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Gross ticket revenue</p><p className="mt-1 font-bold text-slate-900">{money.format(summary.totalGrossRevenue)}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Trips departing</p><p className="mt-1 font-bold text-slate-900">{state.trips.filter((trip) => new Date(trip.departureTime).getTime() >= Date.now()).length}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Passengers checked in</p><p className="mt-1 font-bold text-slate-900">{state.tickets.filter((ticket) => ticket.status === 'CHECKED_IN').length}</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Quick actions</h2>
          <div className="mt-3 space-y-2">
            {actions.map((action) => (
              <button key={action.section} onClick={() => onNavigate(action.section)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50">
                <p className="text-sm font-bold text-slate-800">{action.title}</p><p className="mt-1 text-xs text-slate-500">{action.detail}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-bold">Demo data notice</p>
        <p className="mt-1 text-xs leading-5">Sign-in and role checks use the backend JWT API. Dashboard operations reuse the existing browser-local prototype state and are not persisted to the backend database.</p>
      </section>
    </div>
  );
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return 'System administrator';
    case 'ASSOCIATE_MANAGER':
      return 'Association manager';
    case 'TERMINAL_CLERK':
      return 'Terminal clerk';
    default:
      return 'Passenger';
  }
}
