import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let body: { phoneNumber?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'A valid JSON login body is required.' }, { status: 400 });
  }

  if (!body.phoneNumber?.trim() || !body.password) {
    return NextResponse.json({ message: 'Phone number and password are required.' }, { status: 400 });
  }

  const apiUrl = process.env.TRANSPORT_API_URL || 'http://localhost:8080';
  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: body.phoneNumber.trim(), password: body.password }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'The authentication service is unavailable. Please try again later.' },
      { status: 502 },
    );
  }

  const result = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(
      { message: result?.message || result?.error || 'Sign-in failed.' },
      { status: upstream.status },
    );
  }

  if (!result?.accessToken || !result?.user?.role) {
    return NextResponse.json({ message: 'Authentication service returned an incomplete session.' }, { status: 502 });
  }

  const response = NextResponse.json({ user: result.user });
  response.cookies.set('transport_token', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.max(1, Number(result.expiresInSeconds) || 900),
  });
  return response;
}
