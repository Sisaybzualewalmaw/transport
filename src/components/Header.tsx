/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Locale, TRANSLATIONS } from '../utils/translations';
import { formatDualDate } from '../utils/ethiopianCalendar';
import {
  Bus,
  Globe,
  Shield,
  UserCheck,
  Calendar,
  LogOut,
  UserPlus,
  Edit3,
  Key,
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onRoleChange: (role: UserRole) => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  unresolvedLockCount: number;
  users: User[];
  onUserUpdate: (updatedUser: User) => void;
  onUserRegister: (newUser: User) => boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onRoleChange,
  locale,
  onLocaleChange,
  users,
  onUserUpdate,
  onUserRegister,
}) => {
  const t = TRANSLATIONS[locale];
  const now = new Date();
  const dualDate = formatDualDate(now);

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'profile' | 'login' | 'register'>('profile');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  // Form states
  const [editName, setEditName] = useState<string>(currentUser.name);
  const [editPhone, setEditPhone] = useState<string>(currentUser.phone);
  const [regRole, setRegRole] = useState<UserRole>('TRAVELER');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const roles: { role: UserRole; label: string; badge: string; color: string }[] = [
    { role: 'TRAVELER', label: t.roleTraveler, badge: 'Passenger', color: 'bg-emerald-600' },
    { role: 'TERMINAL_CLERK', label: t.roleClerk, badge: 'Station POS', color: 'bg-blue-600' },
    { role: 'OPERATOR_DRIVER', label: t.roleDriver, badge: 'Driver View', color: 'bg-amber-600' },
    { role: 'ASSOCIATE_MANAGER', label: t.roleManager, badge: 'Fleet Mgr', color: 'bg-purple-600' },
    { role: 'SYSTEM_ADMIN', label: t.roleAdmin, badge: 'ETA Regulator', color: 'bg-rose-700' },
  ];

  const currentRoleConfig = roles.find((r) => r.role === currentUser.role) || roles[0];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editPhone.trim()) {
      setAuthError('Name and Phone number are required.');
      return;
    }

    // Check collision if phone changed
    if (editPhone !== currentUser.phone && users.some((u) => u.phone === editPhone && u.id !== currentUser.id)) {
      setAuthError('Update Failed: Phone number is already registered to another account.');
      return;
    }

    onUserUpdate({
      ...currentUser,
      name: editName.trim(),
      phone: editPhone.trim(),
    });
    setAuthSuccess('Profile Updated Successfully!');
    setTimeout(() => {
      setAuthSuccess(null);
      setShowAuthModal(false);
    }, 1000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editPhone.trim()) {
      setAuthError('All fields are mandatory.');
      return;
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: editName.trim(),
      phone: editPhone.trim(),
      role: regRole,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    const ok = onUserRegister(newUser);
    if (!ok) {
      setAuthError('Registration Failed: Phone number already exists in directory.');
    } else {
      setAuthSuccess(`Account created for ${newUser.name}! Switched to ${newUser.role} session.`);
      onRoleChange(regRole);
      setTimeout(() => {
        setAuthSuccess(null);
        setShowAuthModal(false);
      }, 1200);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    onRoleChange('TRAVELER');
    // Display brief logged out notification
    alert('Logged out safely. Session credentials cleared.');
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-lg border-b border-slate-800">
      {/* Top Government/Regulator Notice Bar */}
      <div className="bg-slate-950 px-4 py-1 text-xs flex flex-wrap justify-between items-center text-slate-400 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-slate-300">
            {locale === 'am' ? 'የኢትዮጵያ ፌዴራላዊ ዴሞክራሲያዊ ሪፐብሊክ የትራንስፖርት ባለሥልጣን' : 'Federal Democratic Republic of Ethiopia Transport Authority'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 font-semibold">
            {locale === 'am' ? 'የወልዲያ መነሀሪያ' : 'Woldia Menehariya Terminal'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>{dualDate.combined}</span>
          </div>

          {/* Language Toggle */}
          <button
            onClick={() => onLocaleChange(locale === 'en' ? 'am' : 'en')}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-0.5 rounded text-xs transition cursor-pointer font-semibold border border-slate-700"
            title="Toggle Language / ቋንቋ ይቀይሩ"
          >
            <Globe className="w-3 h-3" />
            <span>{t.langToggle}</span>
          </button>
        </div>
      </div>

      {/* Main App Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-950 text-white font-bold text-xl">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">ET-Trans</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Woldia Central
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {t.subTitle}
              </p>
            </div>
          </div>

          {/* Role Switcher & Active User Profile */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs text-slate-400">{t.switchRole}:</span>
              <button
                onClick={() => {
                  setAuthMode('profile');
                  setEditName(currentUser.name);
                  setEditPhone(currentUser.phone);
                  setShowAuthModal(true);
                }}
                className="text-sm font-semibold text-white hover:text-emerald-300 flex items-center gap-1.5 justify-end transition cursor-pointer"
                title="Manage Account Profile (UC-03)"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentUser.name}</span>
              </button>
            </div>

            <div className="relative">
              <select
                value={currentUser.role}
                onChange={(e) => onRoleChange(e.target.value as UserRole)}
                className={`text-xs font-semibold py-2 px-3 rounded-lg border border-slate-700 shadow-sm transition cursor-pointer focus:ring-2 focus:ring-emerald-500 focus:outline-none ${currentRoleConfig.color} text-white`}
              >
                {roles.map((r) => (
                  <option key={r.role} value={r.role} className="bg-slate-900 text-white py-1">
                    {r.label} ({r.badge})
                  </option>
                ))}
              </select>
            </div>

            {/* Profile & Account Actions */}
            <button
              onClick={() => {
                setAuthMode('register');
                setEditName('');
                setEditPhone('09');
                setShowAuthModal(true);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
              title="Register New Account (UC-01)"
            >
              <UserPlus className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition cursor-pointer border border-slate-700"
              title="Secure Logout (UC-06)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* USER PROFILE / AUTH MODAL (UC-01, UC-02, UC-03) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">
                {authMode === 'profile' && 'Edit Account Profile (UC-03)'}
                {authMode === 'register' && 'Register New System Account (UC-01)'}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
                {authError}
              </div>
            )}
            {authSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200">
                {authSuccess}
              </div>
            )}

            {authMode === 'profile' ? (
              <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Phone Number (Primary System Identifier)
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-800"
                    required
                  />
                </div>
                <div className="p-3 bg-slate-100 rounded-xl text-slate-600 text-[11px]">
                  Operational Role: <span className="font-bold text-slate-800">{currentUser.role}</span>
                  <div className="text-slate-400 mt-0.5">Account Status: Active</div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Select Role Category</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  >
                    <option value="TRAVELER">Traveler / Passenger</option>
                    <option value="TERMINAL_CLERK">Terminal Ticketing Clerk</option>
                    <option value="OPERATOR_DRIVER">Vehicle Operator / Driver</option>
                    <option value="ASSOCIATE_MANAGER">Associate Fleet Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Abebech Gobena"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Phone Number (Unique Identifier)
                  </label>
                  <input
                    type="text"
                    placeholder="0911..."
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-800"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition"
                  >
                    Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL (UC-06) */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Secure Logout Confirmation</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to end your active session as <span className="font-bold text-slate-800">{currentUser.name}</span>?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleLogout}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Yes, Log Out
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                No, Stay
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
