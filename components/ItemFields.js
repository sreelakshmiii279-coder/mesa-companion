'use client';
// Shared fields for adding and editing a task: type, priority, and either a set time or "find me a slot".
import { useState } from 'react';
import { CATEGORIES, PRIORITIES } from '@/lib/categories';

const LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120, 180];
const label = (m) => (m < 60 ? `${m} min` : `${+(m / 60).toFixed(1)} hr${m > 60 ? 's' : ''}`);

export default function ItemFields({ item = {}, today }) {
  const [mode, setMode] = useState(item.mode ?? 'fixed');
  const lengths = [...new Set([...LENGTHS, item.minutes ?? 30])].sort((a, b) => a - b);
  return (
    <>
      <label className="field">What
        <input name="title" required maxLength={120} defaultValue={item.title} placeholder="Gym, laundry, finish SQL workbook…" />
      </label>
      <div className="grid2">
        <label className="field">Type
          <select name="category" defaultValue={item.category ?? 'college'}>
            {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.emoji} {c.label}</option>)}
          </select>
        </label>
        <label className="field">Priority
          <select name="priority" defaultValue={item.priority ?? 'medium'}>
            {Object.entries(PRIORITIES).map(([k, p]) => <option key={k} value={k}>{p.emoji} {p.label}</option>)}
          </select>
        </label>
      </div>

      <input type="hidden" name="mode" value={mode} />
      <div className="seg" style={{ margin: 0 }}>
        <a href="#" className={mode === 'fixed' ? 'on' : ''} onClick={(e) => { e.preventDefault(); setMode('fixed'); }}>🕐 At a set time</a>
        <a href="#" className={mode === 'flex' ? 'on' : ''} onClick={(e) => { e.preventDefault(); setMode('flex'); }}>✨ Find me a slot</a>
      </div>

      {mode === 'fixed' ? (
        <>
          <div className="grid2">
            <label className="field">Day
              <input type="date" name="day" defaultValue={item.day ?? today} min={today} required />
            </label>
            <label className="field">Start
              <input type="time" name="start" defaultValue={item.start} required />
            </label>
          </div>
          <div className="grid2">
            <label className="field">How long
              <select name="duration" defaultValue={String(item.minutes ?? 60)}>
                {lengths.map((m) => <option key={m} value={m}>{label(m)}</option>)}
              </select>
            </label>
            <label className="field">Repeat
              <select name="repeat" defaultValue={item.repeat ?? 'none'}>
                <option value="none">Just once</option>
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
              </select>
            </label>
          </div>
        </>
      ) : (
        <div className="grid2">
          <label className="field">Takes about
            <select name="duration" defaultValue={String(item.minutes ?? 30)}>
              {lengths.map((m) => <option key={m} value={m}>{label(m)}</option>)}
            </select>
          </label>
          <label className="field">Done by (optional)
            <input type="date" name="due_day" defaultValue={item.due ?? ''} min={today} />
          </label>
        </div>
      )}
      {mode === 'flex' && <p className="small muted" style={{ margin: 0 }}>I'll slot it into a free gap: higher priority gets earlier slots, and everything re-plans when you change something.</p>}
    </>
  );
}
