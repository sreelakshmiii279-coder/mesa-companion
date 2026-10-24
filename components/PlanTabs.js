import Link from 'next/link';

const TABS = [['/plan', '✅ Tasks'], ['/deadlines', '⏳ Deadlines']];

export default function PlanTabs({ active }) {
  return (
    <div className="seg">
      {TABS.map(([href, label]) => <Link key={href} href={href} className={href === active ? 'on' : ''}>{label}</Link>)}
    </div>
  );
}
