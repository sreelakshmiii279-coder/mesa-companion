import { redirect } from 'next/navigation';

export default function Notes() {
  redirect('/learn?tab=notes');
}
