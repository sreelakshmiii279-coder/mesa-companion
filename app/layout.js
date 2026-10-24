import './globals.css';
import { Geist } from 'next/font/google';
import { isAuthed } from '@/lib/auth';
import Shell from '@/components/Shell';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata = {
  title: 'Mesa Companion',
  description: 'Deadlines, class notes and a day planner for Term 2.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/192', apple: '/icons/180' },
  appleWebApp: { capable: true, title: 'Mesa', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff5f9' },
    { media: '(prefers-color-scheme: dark)', color: '#170a12' },
  ],
};

export default async function RootLayout({ children }) {
  const authed = await isAuthed();
  return (
    <html lang="en" className={geist.variable}>
      <body>
        {authed
          ? <Shell vapidKey={process.env.VAPID_PUBLIC_KEY}>{children}</Shell>
          : <main className="page">{children}</main>}
      </body>
    </html>
  );
}
