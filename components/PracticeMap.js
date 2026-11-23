'use client';
// Components-map practice: fill a swimlane grid for each case, check it, then compare with a model map.
// Work is saved in this browser (localStorage).
import { useEffect, useState } from 'react';
import { CASES, COLUMNS, grade } from '@/lib/practice';

const KEY = 'practice:components-maps';
const KINDS = [
  { key: 'auto', label: 'Auto', title: 'Automated' },
  { key: 'human', label: 'Human', title: 'Human' },
  { key: 'none', label: 'Not used', title: 'Not used' },
];
const emptyRow = () => ({ actor: '', sub: '', cells: {}, gate: false, logged: false });
const emptyMap = () => ({ rows: Array.from({ length: 6 }, emptyRow), flows: '' });

const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
};

function ModelMap({ map }) {
  return (
    <div className="pm-scroll">
      <table className="pm-table model">
        <thead><tr><th>Actor</th>{COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {map.rows.map((row, i) => (
            <tr key={i} className={row.gate ? 'gate' : ''}>
              <td className="pm-actor"><b>{row.actor}</b><span>{row.sub}</span>
                {row.logged && <em className="pm-logged">logged</em>}</td>
              {COLUMNS.map((c) => {
                const cell = row.cells[c.key];
                return <td key={c.key}>{cell && <div className={`pm-box k-${cell.kind}`}>{cell.text}</div>}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pm-flows"><b>Arrows and loops:</b> {map.flows}</div>
    </div>
  );
}

export default function PracticeMap() {
  const [idx, setIdx] = useState(0);
  const [maps, setMaps] = useState({});        // { caseId: map }
  const [results, setResults] = useState(null);
  const [showModel, setShowModel] = useState(false);

  useEffect(() => { setMaps(store.get()); }, []);

  const c = CASES[idx];
  const map = maps[c.id] || emptyMap();
  const save = (next) => {
    const all = { ...maps, [c.id]: next };
    setMaps(all);
    store.set(all);
  };
  const setRow = (i, patch) => save({ ...map, rows: map.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setCell = (i, col, patch) => {
    const row = map.rows[i];
    const cur = row.cells[col] || { text: '', kind: '' };
    setRow(i, { cells: { ...row.cells, [col]: { ...cur, ...patch } } });
  };
  const go = (n) => { setIdx(n); setResults(null); setShowModel(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const check = () => { setResults(grade(c.id, map)); setTimeout(() => document.getElementById('pm-results')?.scrollIntoView({ behavior: 'smooth' }), 50); };
  const score = results ? results.filter((x) => x.ok).length : 0;
  const filled = (m) => m && m.rows.some((r) => r.actor.trim() || Object.values(r.cells).some((x) => x.text?.trim()));

  return (
    <div className="pm">
      <a href="/study" className="side-back">← All study guides</a>
      <h1>Components map practice</h1>
      <p className="sub">Read the case, fill the swimlane grid like your Freshroots and Sprinto maps, then check it and compare with a model answer.</p>

      <div className="pm-steps">
        {CASES.map((x, i) => (
          <button key={x.id} type="button" className={`pm-step${i === idx ? ' on' : ''}`} onClick={() => go(i)}>
            <span className="ss-n">{i + 1}</span>
            <span><b>{x.title}</b><small>{'★'.repeat(x.level)}{filled(maps[x.id]) ? ' · started' : ''}</small></span>
          </button>
        ))}
      </div>

      <div className="pm-brief card">
        <div className="pm-brief-head">
          <span className="q-label">Case {idx + 1} of {CASES.length} · difficulty {'★'.repeat(c.level)} · closest to {c.closest}</span>
          <h2>{c.title}</h2>
        </div>
        <div className="pm-brief-grid">
          <div><div className="side-label">Situation</div><p>{c.situation}</p></div>
          <div><div className="side-label">The ask</div><p>{c.ask}</p></div>
          <div><div className="side-label">Think about</div><ul>{c.think.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
        </div>
      </div>

      <div className="pm-legend">
        <span><i className="k-auto" /> Automated</span><span><i className="k-human" /> Human</span>
        <span><i className="k-none" /> Not used</span><span><i className="pm-l-gate" /> Review gate (row)</span>
        <span><i className="pm-l-log" /> Every decision logged (row)</span>
      </div>

      <div className="pm-scroll">
        <table className="pm-table">
          <thead><tr><th>Actor</th>{COLUMNS.map((col) => <th key={col.key}>{col.label}</th>)}<th className="pm-flags">Row</th></tr></thead>
          <tbody>
            {map.rows.map((row, i) => (
              <tr key={i} className={row.gate ? 'gate' : ''}>
                <td className="pm-actor">
                  <input value={row.actor} placeholder="Actor (e.g. Gemini)" onChange={(e) => setRow(i, { actor: e.target.value })} />
                  <input className="sub-in" value={row.sub} placeholder="Role (e.g. Extract facts)" onChange={(e) => setRow(i, { sub: e.target.value })} />
                </td>
                {COLUMNS.map((col) => {
                  const cell = row.cells[col.key] || { text: '', kind: '' };
                  return (
                    <td key={col.key}>
                      <textarea className={cell.text ? `k-${cell.kind || 'unset'}` : ''} value={cell.text} rows={3}
                        onChange={(e) => setCell(i, col.key, { text: e.target.value })} />
                      {cell.text?.trim() && (
                        <div className="pm-kinds">
                          {KINDS.map((k) => (
                            <button key={k.key} type="button" title={k.title} className={`pm-kind k-${k.key}${cell.kind === k.key ? ' on' : ''}`}
                              onClick={() => setCell(i, col.key, { kind: k.key })}>{k.label}</button>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="pm-flags">
                  <label><input type="checkbox" checked={row.gate} onChange={(e) => setRow(i, { gate: e.target.checked })} /> Gate</label>
                  <label><input type="checkbox" checked={row.logged} onChange={(e) => setRow(i, { logged: e.target.checked })} /> Logged</label>
                  <button type="button" className="pm-del" title="Delete row" onClick={() => save({ ...map, rows: map.rows.filter((_, j) => j !== i) })}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn small ghost" style={{ marginTop: 10 }} onClick={() => save({ ...map, rows: [...map.rows, emptyRow()] })}>+ Add actor row</button>

      <label className="field" style={{ marginTop: 18 }}>Arrows and loops (what flows where; any loops, with their cap; what feeds back)
        <textarea rows={3} value={map.flows} placeholder="e.g. Scraper → Gemini → Qualifier; Qualifier ⟲ Scraper (max 2 pages); approvals logged to Neon → next run"
          onChange={(e) => save({ ...map, flows: e.target.value })} />
      </label>

      <div className="row" style={{ marginTop: 16, gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={check}>Check my map</button>
        <button type="button" className="btn ghost" onClick={() => setShowModel((v) => !v)}>{showModel ? 'Hide model answer' : 'Show model answer'}</button>
        <button type="button" className="btn ghost" onClick={() => { if (confirm('Clear your map for this case?')) { save(emptyMap()); setResults(null); } }}>Start over</button>
      </div>

      {results && (
        <div id="pm-results" className="card" style={{ marginTop: 18 }}>
          <div className={`score ${score / results.length >= 0.8 ? 'good' : 'meh'}`}>
            You hit <b>{score} of {results.length}</b> things this case tests.
            {score === results.length ? ' 🎉 Strong map. Compare with the model answer for details.' : ' Fix the ❌ ones, then check again.'}
          </div>
          <ul className="pm-checks">
            {results.map((x, i) => (
              <li key={i} className={x.ok ? 'ok' : 'no'}>
                <span>{x.ok ? '✅' : '❌'}</span>
                <div><b>{x.label}</b>{!x.ok && <div className="muted small">{x.tip}</div>}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showModel && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>Model answer</h2>
          <p className="muted small">One good answer, not the only one. Yours can differ in names and detail as long as the same decisions are there.</p>
          <ModelMap map={c.model} />
        </div>
      )}

      <div className="row between" style={{ marginTop: 28 }}>
        {idx > 0 ? <button type="button" className="btn ghost" onClick={() => go(idx - 1)}>← Case {idx}</button> : <span />}
        {idx < CASES.length - 1 && <button type="button" className="btn" onClick={() => go(idx + 1)}>Next: Case {idx + 2} →</button>}
      </div>
    </div>
  );
}
