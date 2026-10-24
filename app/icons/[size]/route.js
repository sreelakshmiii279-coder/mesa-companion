import { ImageResponse } from 'next/og';

const SIZES = [96, 180, 192, 512];

export function generateStaticParams() {
  return SIZES.map((s) => ({ size: String(s) }));
}

export async function GET(_req, { params }) {
  const size = SIZES.includes(Number((await params).size)) ? Number((await params).size) : 192;
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#ec4899', color: '#fff', fontSize: size * 0.56, fontWeight: 800, fontFamily: 'sans-serif',
      }}>
        M
      </div>
    ),
    { width: size, height: size },
  );
}
