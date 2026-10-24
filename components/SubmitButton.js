'use client';
// Submit button that shows progress, and closes its edit panel once the save has gone through.
import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

export default function SubmitButton({ children, pendingText = 'Saving…', className = 'btn', formAction }) {
  const { pending } = useFormStatus();
  const ref = useRef(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      const details = ref.current?.closest('details');
      if (details) details.open = false;
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <button ref={ref} className={className} disabled={pending} formAction={formAction} style={pending ? { opacity: 0.7 } : undefined}>
      {pending ? pendingText : children}
    </button>
  );
}
