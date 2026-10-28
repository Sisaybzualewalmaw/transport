import { cookies } from 'next/headers';

export interface DashboardUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: 'PASSENGER' | 'TERMINAL_CLERK' | 'ASSOCIATION_MANAGER' | 'ADMIN';
}

export async function getAuthenticatedUser(): Promise<DashboardUser | null> {
  const token = (await cookies()).get('transport_token')?.value;
  if (!token) return null;

  const apiUrl = process.env.TRANSPORT_API_URL || 'http://localhost:8080';
  const response = await fetch(`${apiUrl}/api/users/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(`Unable to validate dashboard session (HTTP ${response.status}).`);
  }

  return (await response.json()) as DashboardUser;
}
