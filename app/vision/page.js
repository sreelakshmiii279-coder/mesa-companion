import { requireAuth } from '@/lib/auth';
import { getVision } from '@/lib/vision';
import { addVision, deleteVision } from '@/app/actions';

export const dynamic = 'force-dynamic';

const Remove = ({ id }) => (
  <form action={deleteVision} className="x">
    <input type="hidden" name="id" value={id} />
    <button aria-label="Remove">×</button>
  </form>
);

export default async function Vision() {
  await requireAuth();
  const vision = await getVision();
  const future = vision.find((v) => v.kind === 'future');
  const identity = vision.filter((v) => v.kind === 'identity');
  const goals = vision.filter((v) => v.kind === 'goal');
  const images = vision.filter((v) => v.kind === 'image');
  return (
    <>
      <h1>Vision</h1>
      <p className="sub">The person you're becoming. Your morning message is written from this board. <a href="/?morning=1">See today's →</a></p>

      <div className="vision-hero">
        <div className="k">Future me</div>
        <div className="v">{future?.text ?? 'Write who you are becoming below.'}</div>
      </div>

      <h2>✨ I am</h2>
      <div className="mosaic">
        {identity.map((v, i) => (
          <div key={v.id} className="tile" style={i % 3 === 0 ? { background: 'var(--class-soft)' } : i % 3 === 1 ? { background: 'var(--task-soft)' } : { background: 'var(--chore-soft)' }}>
            <Remove id={v.id} />
            <div style={{ fontSize: 22 }}>{['⚡', '🌱', '🔥', '🧠', '💪', '🎯'][i % 6]}</div>
            <div style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>{v.text}</div>
          </div>
        ))}
        {images.map((v) => (
          <div key={v.id} className="tile img">
            <Remove id={v.id} />
            <img src={v.image_url} alt={v.text ?? ''} loading="lazy" />
          </div>
        ))}
      </div>

      <h2>🎯 Goals</h2>
      <div className="stack">
        {goals.map((v) => (
          <div key={v.id} className="card row">
            <span className="dot" />
            <div className="grow" style={{ fontWeight: 600 }}>{v.text}</div>
            <form action={deleteVision} className="inline"><input type="hidden" name="id" value={v.id} /><button className="btn small ghost">Remove</button></form>
          </div>
        ))}
      </div>

      <h2>➕ Add to your board</h2>
      <form action={addVision} className="card stack">
        <label className="field">Type
          <select name="kind" defaultValue="identity">
            <option value="identity">"I am…" statement</option>
            <option value="goal">Goal</option>
            <option value="future">Future me (replaces the big one)</option>
            <option value="image">Picture (paste an image link)</option>
          </select>
        </label>
        <label className="field">Text
          <input name="text" maxLength={300} placeholder="I build things people love." />
        </label>
        <label className="field">Image link (for pictures)
          <input name="image_url" type="url" placeholder="https://… (Pinterest / Unsplash image address)" />
        </label>
        <button className="btn block">Add</button>
      </form>
    </>
  );
}
