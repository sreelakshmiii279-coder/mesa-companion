export default function manifest() {
  return {
    name: 'Mesa Companion',
    short_name: 'Mesa',
    description: 'Deadlines, class notes and a day planner for Term 2.',
    start_url: '/',
    display: 'standalone',
    background_color: '#060b12',
    theme_color: '#059669',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
