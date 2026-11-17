'use client';
// Interactive study guide (desktop layout): sidebar with sessions + contents, main column with sections,
// check questions, frameworks, cases, flashcards and a final quiz. Progress is saved in this browser.
import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';

const renderer = new marked.Renderer();
renderer.html = () => '';
const md = (s) => ({ __html: marked.parse(s || '', { renderer }) });

const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } },
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
};

function Question({ q, picked, onPick, label }) {
  const done = picked !== undefined;
  return (
    <div className="card q">
      <div className="q-label">{label}</div>
      <div className="q-text">{q.question}</div>
      <div className="opts">
        {q.options.map((o, i) => {
          const cls = !done ? '' : i === q.answer ? ' right' : i === picked ? ' wrong' : ' dim';
          return (
            <button key={i} type="button" className={`opt${cls}`} disabled={done} onClick={() => onPick(i)}>
              <span className="opt-key">{'ABCD'[i]}</span><span>{o}</span>
            </button>
          );
        })}
      </div>
      {done && (
        <div className={`q-explain ${picked === q.answer ? 'ok' : 'no'}`}>
          <b>{picked === q.answer ? 'Correct.' : `Not quite: the answer is ${'ABCD'[q.answer]}.`}</b> {q.explanation}
        </div>
      )}
    </div>
  );
}

export default function StudyGuide({ slug, courseName, units, guides }) {
  const key = `study:${slug}`;
  const bySession = useMemo(() => Object.fromEntries(guides.map((g) => [g.session, g])), [guides]);
  const [session, setSession] = useState(guides[0]?.session ?? 1);
  const [state, setState] = useState({}); // { "3": { checks: {0: 2}, quiz: {1: 0}, flips: {4: true} } }
  const [terms, setTerms] = useState({});

  useEffect(() => {
    setState(store.get(key));
    const s = Number(new URLSearchParams(location.search).get('s'));
    if (bySession[s]) setSession(s);
  }, [key, bySession]);

  const update = (fn) => setState((prev) => { const next = fn(prev); store.set(key, next); return next; });
  const save = (s, part, idx, val) => update((prev) => {
    const cur = prev[s] || {};
    return { ...prev, [s]: { ...cur, [part]: { ...(cur[part] || {}), [idx]: val } } };
  });
  const reset = (s, part) => update((prev) => ({ ...prev, [s]: { ...(prev[s] || {}), [part]: {} } }));
  const choose = (s) => {
    setSession(s);
    history.replaceState(null, '', `?s=${s}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const progress = (s) => {
    const g = bySession[s]?.guide;
    if (!g) return 0;
    const st = state[s] || {};
    const total = g.sections.filter((x) => x.check).length + g.quiz.length;
    const done = Object.keys(st.checks || {}).length + Object.keys(st.quiz || {}).length;
    return total ? Math.round((done / total) * 100) : 0;
  };

  const entry = bySession[session];
  const g = entry?.guide;
  const st = state[session] || {};
  const quizDone = g ? Object.keys(st.quiz || {}).length : 0;
  const quizScore = g ? g.quiz.reduce((n, q, i) => n + ((st.quiz || {})[i] === q.answer ? 1 : 0), 0) : 0;
  const sessions = units.map((u) => u.n);
  const labelOf = Object.fromEntries(units.map((u) => [u.n, u.label]));
  const nextSession = sessions.find((s) => s > session && bySession[s]);

  return (
    <div className="study-layout">
      <aside className="study-side">
        <a href="/study" className="side-back">← All courses</a>
        <div className="side-title">{courseName}</div>
        <div className="side-sub">Interactive study guide</div>
        <nav className="side-sessions">
          {sessions.map((s) => {
            const has = !!bySession[s];
            const p = progress(s);
            return (
              <button key={s} type="button" disabled={!has} onClick={() => choose(s)}
                className={`side-session${s === session ? ' on' : ''}`}>
                <span className="ss-n">{s}</span>
                <span className="ss-body">
                  <span className="ss-title">{has ? bySession[s].guide.title : labelOf[s] || 'Being prepared'}</span>
                  {has && <span className="ss-bar"><i style={{ width: `${p}%` }} /></span>}
                </span>
                <span className="ss-p">{has ? (p === 100 ? '✓' : `${p}%`) : ''}</span>
              </button>
            );
          })}
        </nav>
        {g && (
          <nav className="side-toc">
            <div className="side-label">In this session</div>
            {g.sections.map((sec, i) => <a key={i} href={`#sec-${i}`}>{i + 1}. {sec.heading}</a>)}
            {g.frameworks.length > 0 && <a href="#frameworks">Frameworks</a>}
            {g.examples.length > 0 && <a href="#cases">Cases from class</a>}
            <a href="#flashcards">Flashcards</a>
            <a href="#quiz">Final quiz</a>
            {g.exam_tips.length > 0 && <a href="#tips">Exam tips</a>}
          </nav>
        )}
      </aside>

      <article className="study-main">
        {!g ? (
          <div className="card empty">This session's guide is being prepared from Nexus. It'll appear here automatically.</div>
        ) : (
          <>
            <header className="study-hero">
              <div className="k">Session {session}</div>
              <h1 className="v">{g.title}</h1>
              <p>{g.one_line}</p>
              <div className="src-chips">
                <span>📚 Built from {entry.sources.used ? entry.sources.used.length : 0} source{entry.sources.used?.length === 1 ? '' : 's'}</span>
                {entry.sources.notes_used && <span>🎥 Class recording</span>}
                {entry.sources.label && <span>{entry.sources.label}</span>}
              </div>
            </header>

            <div className="card">
              <div className="side-label" style={{ marginBottom: 6 }}>By the end you can</div>
              <ul className="goals">{g.goals.map((x, i) => <li key={i}>{x.replace(/^you will be able to\s*/i, '')}</li>)}</ul>
            </div>

            {entry.sources.materials?.length > 0 && (
              <details className="card" style={{ marginTop: 12 }}>
                <summary style={{ margin: 0 }}>On Nexus for this session ({entry.sources.materials.length}{entry.sources.recordings?.length ? ` + ${entry.sources.recordings.length} recording` + (entry.sources.recordings.length > 1 ? 's' : '') : ''})</summary>
                <ul className="mat-list" style={{ marginTop: 10 }}>
                  {entry.sources.materials.map((m, i) => (
                    <li key={i}>
                      {m.url ? <a href={m.url} target="_blank" rel="noreferrer">{m.title}</a> : m.title}
                      <span className="tag">{m.type === 'list' ? 'not read (data / form / link)' : m.topic}</span>
                    </li>
                  ))}
                  {entry.sources.recordings?.map((r, i) => <li key={`r${i}`}>🎥 {r}<span className="tag">recording</span></li>)}
                </ul>
                {entry.sources.skipped?.length > 0 && <p className="small muted">Couldn't read: {entry.sources.skipped.join('; ')}</p>}
              </details>
            )}

            {g.sections.map((sec, i) => (
              <section key={i} id={`sec-${i}`} className="study-sec">
                <h2>{i + 1}. {sec.heading}</h2>
                <div className="sec-grid">
                  <div className="card md" dangerouslySetInnerHTML={md(sec.body)} />
                  {sec.key_terms?.length > 0 && (
                    <div className="terms">
                      <div className="side-label">Key terms (click)</div>
                      {sec.key_terms.map((t, j) => {
                        const id = `${session}-${i}-${j}`;
                        return (
                          <button key={j} type="button" className={`term${terms[id] ? ' open' : ''}`}
                            onClick={() => setTerms((x) => ({ ...x, [id]: !x[id] }))}>
                            <b>{t.term}</b>{terms[id] && <span>{t.meaning}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {sec.check && (
                  <Question q={sec.check} label="✋ Check yourself" picked={(st.checks || {})[i]}
                    onPick={(v) => save(session, 'checks', i, v)} />
                )}
              </section>
            ))}

            {g.frameworks.length > 0 && (
              <section id="frameworks">
                <h2>🧩 Frameworks</h2>
                <div className="grid-2">
                  {g.frameworks.map((f, i) => (
                    <div key={i} className="card"><b>{f.name}</b><ol className="fw">{f.steps.map((s, j) => <li key={j}>{s}</li>)}</ol></div>
                  ))}
                </div>
              </section>
            )}

            {g.examples.length > 0 && (
              <section id="cases">
                <h2>🏢 Cases from class</h2>
                <div className="grid-2">
                  {g.examples.map((e, i) => (
                    <div key={i} className="card"><b>{e.name}</b><div className="muted" style={{ marginTop: 6 }}>{e.lesson}</div></div>
                  ))}
                </div>
              </section>
            )}

            <section id="flashcards">
              <div className="row between">
                <h2>🃏 Flashcards</h2>
                <button type="button" className="btn small ghost" onClick={() => reset(session, 'flips')}>Hide all</button>
              </div>
              <div className="flash-grid">
                {g.flashcards.map((c, i) => {
                  const flipped = !!(st.flips || {})[i];
                  return (
                    <button key={i} type="button" className={`flash${flipped ? ' flipped' : ''}`}
                      onClick={() => save(session, 'flips', i, !flipped)}>
                      <span className="flash-side">{flipped ? 'Answer' : 'Click to reveal'}</span>
                      <span className="flash-text">{flipped ? c.back : c.front}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section id="quiz">
              <div className="row between">
                <h2>📝 Final quiz</h2>
                {quizDone > 0 && <button type="button" className="btn small ghost" onClick={() => reset(session, 'quiz')}>Retry</button>}
              </div>
              {quizDone === g.quiz.length && (
                <div className={`score ${quizScore / g.quiz.length >= 0.8 ? 'good' : 'meh'}`}>
                  You scored <b>{quizScore}/{g.quiz.length}</b>
                  {quizScore === g.quiz.length ? ' 🎉 Perfect.' : quizScore / g.quiz.length >= 0.8 ? ' Nice work.' : '. Re-read the sections behind the ones you missed, then retry.'}
                </div>
              )}
              <div className="stack">
                {g.quiz.map((q, i) => (
                  <Question key={i} q={q} label={`Question ${i + 1} of ${g.quiz.length}`} picked={(st.quiz || {})[i]}
                    onPick={(v) => save(session, 'quiz', i, v)} />
                ))}
              </div>
            </section>

            {g.exam_tips.length > 0 && (
              <section id="tips">
                <h2>💡 Exam tips</h2>
                <div className="card"><ul className="goals" style={{ margin: 0 }}>{g.exam_tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
              </section>
            )}

            {nextSession && (
              <button type="button" className="btn" style={{ marginTop: 28 }} onClick={() => choose(nextSession)}>
                Next: Session {nextSession} →
              </button>
            )}
          </>
        )}
      </article>
    </div>
  );
}
