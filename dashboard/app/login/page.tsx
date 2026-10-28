'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, LockKeyhole } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Sign-in failed.');
      if (result.user.role === 'PASSENGER') {
        await fetch('/api/auth/logout', { method: 'POST' });
        throw new Error('This dashboard is for administrators, association managers, and terminal clerks.');
      }
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
        <div className="mb-7 flex items-center gap-3">
          <span className="rounded-xl bg-emerald-600 p-3 text-white"><Bus size={22} /></span>
          <div>
            <p className="text-sm font-bold text-slate-900">ET-Trans</p>
            <p className="text-xs text-slate-500">Operations dashboard</p>
          </div>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Sign in to your workspace</h1>
        <p className="mt-2 text-sm text-slate-500">Use your registered transport system account.</p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Phone number
            <input
              autoComplete="username"
              inputMode="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="09xxxxxxxx or +2519xxxxxxxx"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              required
            />
          </label>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
            <LockKeyhole size={16} />
            {busy ? 'Signing in…' : 'Sign in securely'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-500">Access is determined by your assigned JWT role.</p>
      </section>
    </main>
  );
}
