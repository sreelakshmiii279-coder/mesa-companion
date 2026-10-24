const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const label = (m) => (m < 60 ? `${m} min` : `${+(m / 60).toFixed(1)} hr${m > 60 ? 's' : ''}`);

/** Fields shared by the "add task" and "edit task" forms. */
export default function TaskFields({ task = {}, minDay }) {
  const durations = [...new Set([...DURATIONS, task.duration ?? 60])].sort((a, b) => a - b);
  return (
    <>
      <label className="field">What
        <input name="title" required maxLength={120} defaultValue={task.title} placeholder="Gym, cook dinner, finish SQL workbook…" />
      </label>
      <div className="grid2">
        <label className="field">Day
          <input type="date" name="day" defaultValue={task.day} min={minDay} required />
        </label>
        <label className="field">Start
          <input type="time" name="start" defaultValue={task.start} required />
        </label>
      </div>
      <div className="grid2">
        <label className="field">How long
          <select name="duration" defaultValue={String(task.duration ?? 60)}>
            {durations.map((m) => <option key={m} value={m}>{label(m)}</option>)}
          </select>
        </label>
        <label className="field">Repeat
          <select name="repeat" defaultValue={task.repeat ?? 'none'}>
            <option value="none">Just once</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays</option>
          </select>
        </label>
      </div>
    </>
  );
}
