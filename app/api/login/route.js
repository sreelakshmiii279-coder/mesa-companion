import { NextResponse } from 'next/server';
import { checkPassword, sessionToken, COOKIE } from '@/lib/auth';

export async function POST(req) {
  const form = await req.formData();
  if (!checkPassword(form.get('password'))) {
    return NextResponse.redirect(new URL('/login?error=1', req.url), 303);
  }
  const res = NextResponse.redirect(new URL('/', req.url), 303);
  res.cookies.set(COOKIE, sessionToken(), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
