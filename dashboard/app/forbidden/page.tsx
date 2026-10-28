import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard access required</h1>
        <p className="mt-2 text-sm text-slate-600">
          This account does not have an administrative, association manager, or terminal clerk role.
        </p>
        <Link className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href="/login">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
