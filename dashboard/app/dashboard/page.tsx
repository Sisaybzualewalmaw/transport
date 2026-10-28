import { redirect } from 'next/navigation';
import { DashboardClient } from './dashboard-client';
import { getAuthenticatedUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login');
  if (user.role === 'PASSENGER') redirect('/forbidden');

  return <DashboardClient initialUser={user} />;
}
