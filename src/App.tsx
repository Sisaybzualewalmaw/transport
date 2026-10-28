/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppState, UserRole } from './types';
import { loadStoredState, saveState, cleanupExpiredLocksInState } from './store/transportStore';
import { Locale } from './utils/translations';
import { Header } from './components/Header';
import { TravelerPortal } from './components/TravelerPortal';
import { ClerkPortal } from './components/ClerkPortal';
import { DriverPortal } from './components/DriverPortal';
import { ManagerPortal } from './components/ManagerPortal';
import { AdminPortal } from './components/AdminPortal';
import { Download } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadStoredState());
  const [currentRole, setCurrentRole] = useState<UserRole>('TRAVELER');
  const [locale, setLocale] = useState<Locale>('en');

  // Background daemon to sweep expired 10-minute hold locks (PRD Section 3.6.1 SD-04)
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prevState) => {
        const stateCopy = JSON.parse(JSON.stringify(prevState));
        const changed = cleanupExpiredLocksInState(stateCopy);
        if (changed) {
          saveState(stateCopy);
          return stateCopy;
        }
        return prevState;
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Sync state changes to storage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Find active user representing current operational role
  const currentUser =
    state.users.find((u) => u.role === currentRole) || {
      id: 'usr-default',
      name: 'Default User',
      phone: '0911000000',
      role: currentRole,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

  const handleUserUpdate = (updatedUser: any) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
    }));
  };

  const handleUserRegister = (newUser: any): boolean => {
    if (state.users.some((u) => u.phone === newUser.phone)) {
      return false;
    }
    setState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
    }));
    return true;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header with Dual Calendar, Language Toggle, and Role Switcher */}
      <Header
        currentUser={currentUser}
        onRoleChange={setCurrentRole}
        locale={locale}
        onLocaleChange={setLocale}
        unresolvedLockCount={0}
        users={state.users}
        onUserUpdate={handleUserUpdate}
        onUserRegister={handleUserRegister}
      />

      {/* Main Viewport depending on Role-Based Access Control (RBAC) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentRole === 'TRAVELER' && (
          <TravelerPortal
            currentUser={currentUser}
            state={state}
            setState={setState}
            locale={locale}
          />
        )}

        {currentRole === 'TERMINAL_CLERK' && (
          <ClerkPortal
            currentUser={currentUser}
            state={state}
            setState={setState}
            locale={locale}
          />
        )}

        {currentRole === 'OPERATOR_DRIVER' && (
          <DriverPortal
            currentUser={currentUser}
            state={state}
            setState={setState}
            locale={locale}
          />
        )}

        {currentRole === 'ASSOCIATE_MANAGER' && (
          <ManagerPortal
            state={state}
            setState={setState}
            locale={locale}
          />
        )}

        {currentRole === 'SYSTEM_ADMIN' && (
          <AdminPortal
            currentUser={currentUser}
            state={state}
            setState={setState}
            locale={locale}
          />
        )}
      </main>

      {/* Footer with Woldia University Senior Project Attribution */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <p className="font-semibold text-slate-200">
              Transport Scheduling and Ticket Booking System
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Woldia University • School of Computing • Department of Software Engineering (Advisor: Mr. Zeleke C.)
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="/et-trans-project.zip"
              download="et-trans-woldia-system.zip"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Source Code (.ZIP)</span>
            </a>
            <div className="text-center sm:text-right text-[11px] text-slate-500">
              <span>Semen Wolo Transport Logistics & ETA</span>
              <div className="text-emerald-400 font-mono mt-0.5">
                Woldia Menehariya System v1.0.0
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
