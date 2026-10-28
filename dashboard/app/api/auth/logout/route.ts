import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set('transport_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
