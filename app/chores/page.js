import { redirect } from 'next/navigation';

// Chores now live in the single Tasks tab.
export default function Chores() {
  redirect('/plan');
}
