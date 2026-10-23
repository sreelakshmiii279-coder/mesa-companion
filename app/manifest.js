export default function manifest() {
  return {
    name: 'Mesa Companion',
    short_name: 'Mesa',
    description: 'Deadlines, class notes and a day planner for Term 2.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f5f2',
    theme_color: '#c2410c',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
