// Components-map practice: five case briefs, a model swimlane map for each, and the checks a grader would apply.
// A map is { rows: [{ actor, sub, cells: { trigger|input|context|processing|ai|output: { text, kind } }, gate, logged }], flows }.
// kind: 'auto' | 'human' | 'none'.

export const COLUMNS = [
  { key: 'trigger', label: 'Trigger' },
  { key: 'input', label: 'Input' },
  { key: 'context', label: 'Context' },
  { key: 'processing', label: 'Processing' },
  { key: 'ai', label: 'AI' },
  { key: 'output', label: 'Output' },
];

const r = (actor, sub, col, kind, text, extra = {}) => ({ actor, sub, cells: { [col]: { text, kind } }, gate: false, logged: false, ...extra });

export const CASES = [
  {
    id: 'chai-point',
    title: 'Chai Point Express',
    level: 2,
    closest: 'Freshroots',
    situation: `A chain of 40 tea kiosks in Bengaluru throws away ₹9–12 lakh a month of milk, snacks and pastries that expire unsold.
Each kiosk manager orders by gut feel every evening on WhatsApp. The POS system (Petpooja) exports yesterday's sales per kiosk at
11 pm. Weather and local events (cricket matches, office holidays) change demand a lot. Kavya, the ops head, has written down the
ordering rules the best managers use.`,
    ask: `A system that recommends tomorrow's order per kiosk per item. Kiosk managers can adjust it, but every adjustment needs a
reason. Orders above ₹50,000 per kiosk need Kavya's approval. The supplier gets one consolidated PO by 6 am.`,
    think: ['Does this need AI at all, or are documented rules enough?', 'Where do weather and events come from?',
      'Who are the human gates?', 'What tells you it is failing: wastage %, stock-outs, how often managers override it?'],
    model: {
      rows: [
        r('Petpooja POS', 'Sales export', 'trigger', 'auto', 'Nightly 11 pm sales export', { cells: {
          trigger: { text: 'Nightly 11 pm sales export', kind: 'auto' }, input: { text: 'Sales per kiosk, per item', kind: 'auto' } } }),
        r('Weather + events', 'External feed', 'context', 'auto', 'Rain, matches, office holidays'),
        r('Kavya', 'Rules owner', 'context', 'human', 'Documented ordering rules (versioned)'),
        r('Neon', 'Postgres memory', 'context', 'auto', 'Sales history, rule versions, past orders'),
        r('Rules engine', 'Code, no AI', 'processing', 'auto', 'Baseline × event uplift − stock on hand = order qty'),
        r('AI', 'Not used', 'ai', 'none', 'None: the logic is documented rules'),
        r('Kiosk manager', 'Adjust gate', 'output', 'human', 'Edits qty, must give a reason', { gate: true, logged: true }),
        r('Kavya', 'Approval gate', 'output', 'human', 'Approves any kiosk order > ₹50k', { gate: true, logged: true }),
        r('Supplier', 'One PO', 'output', 'auto', 'Consolidated PO sent by 6 am'),
        r('Kavya', 'Metrics view', 'output', 'auto', 'Wastage %, stock-outs, override rate (kill checks)'),
      ],
      flows: 'POS → rules engine; weather/events + Kavya\'s rules + Neon history → rules engine → kiosk manager (adjust + reason) → Kavya if > ₹50k → one PO to supplier by 6 am. Every override and approval logged to Neon; override reasons feed the next rules review.',
    },
    checks: [
      { label: 'AI is not used for the order maths', test: (m) => !aiUsed(m),
        tip: 'Kavya has already written the rules down. Documented, deterministic logic belongs in code; AI here only adds risk and cost (Freshroots made the same call).' },
      { label: 'Two human gates: manager adjustment and Kavya’s ₹50k approval', test: (m) => gates(m) >= 2,
        tip: 'Mark both the kiosk manager and Kavya as review gates: one edits, one approves high-value orders.' },
      { label: 'Adjustments require a reason', test: (m) => has(m, /reason/),
        tip: 'The brief asks for a reason with every adjustment; it is what lets you improve the rules later.' },
      { label: 'Weather and events come in as context', test: (m) => hasIn(m, 'context', /weather|event|match|holiday|rain/),
        tip: 'Demand swings with weather and events, so they belong in the Context column feeding the engine.' },
      { label: 'Decisions are logged', test: (m) => logged(m) >= 1, tip: 'Tick "Logged" on the steps whose decisions must be stored (overrides, approvals).' },
      { label: 'There is a way to tell it is failing (metrics / kill check)', test: (m) => has(m, /wastage|waste|stock.?out|override rate|kill/),
        tip: 'Add an output that tracks wastage %, stock-outs and override rate: your kill criteria.' },
    ],
  },
  {
    id: 'pocket-cfo',
    title: 'Pocket CFO for D2C founders',
    level: 3,
    closest: 'Funding Pulse',
    situation: `An accelerator supports 25 D2C brands. Each founder emails a monthly MIS spreadsheet in a different format. The
program manager, Rohan, spends 2 days a month reading them and still misses warning signs: CAC creeping up, cash runway under 6
months, return rates spiking.`,
    ask: `Every 1st of the month, collect the MIS files from a shared Drive folder, standardise the numbers, spot red flags, and send
Rohan one briefing ranking which 5 founders need a call this week, with the reason and the exact numbers. Rohan marks each flag
"useful" or "noise", and next month's briefing should learn from that.`,
    think: ['What is code (parsing, ratios) and what is AI (reading messy sheets, writing the brief)?',
      'Where does Rohan’s useful/noise feedback go back into the system?', 'What happens when a file is missing or unreadable?'],
    model: {
      rows: [
        r('Scheduler', 'Monthly cron', 'trigger', 'auto', '1st of every month'),
        r('Founders', 'Upload MIS', 'input', 'human', 'MIS sheets in shared Drive, any format'),
        r('Drive reader', 'Code', 'input', 'auto', 'Fetch files; missing or unreadable → flagged, never skipped', { logged: true }),
        r('Gemini', 'Read sheets', 'ai', 'auto', 'Map messy columns to standard fields (revenue, CAC, cash…)'),
        r('Metrics engine', 'Code, no AI', 'processing', 'auto', 'Runway, CAC trend, return rate; red-flag thresholds'),
        r('Neon', 'Postgres memory', 'context', 'auto', 'Past months, past flags, Rohan’s useful/noise marks'),
        r('Gemini', 'Rank + write', 'ai', 'auto', 'Top 5 founders, reason + exact numbers'),
        r('Briefing', 'Email / page', 'output', 'auto', 'One brief to Rohan'),
        r('Rohan', 'Feedback gate', 'output', 'human', 'Marks each flag useful / noise', { gate: true, logged: true }),
      ],
      flows: 'Cron → Drive reader → Gemini maps columns → metrics engine computes flags (code) → Gemini ranks top 5 using Neon history → brief to Rohan → Rohan marks useful/noise → stored in Neon → next month’s ranking weighs flag types Rohan found useful (feedback loop). Missing files appear in the brief as “not received”.',
    },
    checks: [
      { label: 'Red flags are computed in code, not by AI', test: (m) => hasIn(m, 'processing', /runway|cac|return|flag|threshold|ratio/),
        tip: 'Runway, CAC and return-rate thresholds are arithmetic: put them in Processing as code. AI reads the messy sheets and writes the brief.' },
      { label: 'AI used where it helps: reading messy sheets and/or writing the brief', test: (m) => aiUsed(m),
        tip: 'Every founder uses a different format: mapping columns and writing a ranked brief are good AI jobs.' },
      { label: 'Missing or unreadable files are handled visibly', test: (m) => has(m, /missing|unreadable|not received|fail/),
        tip: 'A missing MIS must show up in the brief, not silently vanish (the “bare except” trap from class).' },
      { label: 'Rohan’s useful/noise feedback loops back', test: (m) => has(m, /useful|noise|feedback/) && logged(m) >= 1,
        tip: 'Store Rohan’s marks (Logged) and feed them back as Context for next month: that is the Session 5 feedback loop.' },
      { label: 'Rohan is a human gate', test: (m) => gates(m) >= 1, tip: 'Mark Rohan’s review row as a review gate.' },
      { label: 'History is used as context', test: (m) => hasIn(m, 'context', /history|past|previous|last month|neon|memory/),
        tip: 'Trends (CAC creeping up) need last months’ numbers: add a memory/history row in Context.' },
    ],
  },
  {
    id: 'placement-desk',
    title: 'Mesa Placement Desk',
    level: 3,
    closest: 'Sprinto',
    situation: `Mesa’s placement team wants to reach 200 Series A–C startups a term for internships. Today one coordinator, Ananya,
finds companies on LinkedIn, guesses who hires, and writes each email by hand: 25 minutes per company.`,
    ask: `Given a list of startup domains: check whether the company is actually hiring for roles that match Mesa’s 4 specialisations
(careers page, job boards), find the right person (Head of Talent or a founder, depending on size), and draft a personal email that
mentions a real open role. Nothing goes out without Ananya’s approval. Replies come back to a shared inbox.`,
    think: ['The agent loop: what if the careers page doesn’t say enough? Where is the cap?',
      'Where does the contact come from: a data vendor or a manual list?', 'What happens after sending, when replies come in?'],
    model: {
      rows: [
        r('Ananya', 'Starts a run', 'trigger', 'human', 'Pastes domain list'),
        r('Web app', 'Code', 'input', 'auto', 'Clean, dedupe, daily cap'),
        r('Placement head', 'Rules owner', 'context', 'human', 'Owns the Mesa specialisations list and which role titles count'),
        r('Neon', 'Postgres memory', 'context', 'auto', 'Specialisations + role rules (versioned), run history, past contacts, Ananya\'s edits, replies'),
        r('Careers pages', 'Job boards', 'context', 'auto', 'Careers page, LinkedIn / job board listings'),
        r('Scraper', 'Code', 'processing', 'auto', 'Fetch + strip; unreadable flagged'),
        r('Gemini', 'Extract roles', 'ai', 'auto', 'Open roles + quotes as JSON'),
        r('Qualifier', 'Code, no AI', 'processing', 'auto', 'Loop ≤2 more pages; qualified = open role in a Mesa specialisation', { logged: true }),
        r('Contacts', 'Apollo / Hunter', 'context', 'auto', 'Head of Talent (50+ people) or founder'),
        r('Gemini', 'Draft', 'ai', 'auto', 'Email citing a real open role'),
        r('Ananya', 'Approval gate', 'output', 'human', 'Approves / edits before anything is sent', { gate: true, logged: true }),
        r('Sender', 'Gmail', 'output', 'auto', 'Sends approved emails only'),
        r('Shared inbox', 'Replies', 'input', 'auto', 'Replies arrive'),
        r('Gemini', 'Sort replies', 'ai', 'auto', 'Interested / not now / wrong person → Ananya'),
      ],
      flows: 'Ananya → web app → scraper → Gemini extracts roles → qualifier (code) loops back to scraper for careers/jobs pages, max 2 → contact from Apollo/Hunter → Gemini drafts → Ananya approves → Gmail sends → replies into shared inbox → Gemini sorts → Ananya. Placement head → Neon role rules → qualifier reads the current rules version each run. Every decision (qualifier verdict, approvals/edits, reply labels) logged to Neon with its reason.',
    },
    checks: [
      { label: 'The fetch-more loop has a cap', test: (m) => has(m, /cap|max|limit|≤|at most|<=/), tip: 'An agent loop without a limit can run forever and burn API budget: write the cap (e.g. ≤2 extra pages).' },
      { label: '“Qualified” is defined by real open roles in Mesa’s specialisations', test: (m) => has(m, /role|hiring|opening|specialis|specializ/),
        tip: 'Qualification must be a checkable fact: an open role that matches one of the 4 specialisations.' },
      { label: 'Contact comes from a named source', test: (m) => has(m, /apollo|hunter|vendor|manual|list|linkedin/),
        tip: 'Say where the person comes from (Apollo/Hunter or a manual list), not just “find contact”.' },
      { label: 'Ananya approves before anything is sent', test: (m) => gates(m) >= 1 && has(m, /approv/), tip: 'The brief says nothing goes out without her approval: mark that row as a review gate.' },
      { label: 'Replies are handled after sending', test: (m) => has(m, /repl|inbox/), tip: 'The system doesn’t end at “send”: replies come back to a shared inbox and need sorting.' },
      { label: 'Decisions are logged', test: (m) => logged(m) >= 1, tip: 'Log why each company qualified and why each person was chosen: “defend every decision”.' },
    ],
  },
  {
    id: 'clinic-triage',
    title: 'Clinic triage line',
    level: 4,
    closest: 'All In Capital',
    situation: `A chain of 12 clinics receives about 600 WhatsApp messages a day: appointment requests, report queries, billing, and
occasionally something urgent (“chest pain since morning”). Three front-desk staff answer in order of arrival, so urgent messages
can wait 2 hours.`,
    ask: `Sort every incoming message by category and urgency. Draft replies for routine ones (appointments, timings) that staff
approve with one tap. Anything medically urgent goes straight to the duty nurse within 2 minutes, with no AI reply to the patient.
Every decision must be auditable by the medical director, Dr Mehra.`,
    think: ['Where must AI NOT act?', 'Two different human gates?', 'Fail-safe: if the AI is unsure, does urgency go up or down?',
      'Privacy: what is stored and who sees it?', 'How do you test (evals) that urgent cases are never missed?'],
    model: {
      rows: [
        r('Patient', 'WhatsApp', 'trigger', 'human', 'Sends a message'),
        r('WhatsApp API', 'Code', 'input', 'auto', 'Message + clinic + time'),
        r('Safety screen', 'Code, no AI', 'processing', 'auto', 'Red-flag words (chest pain, breathless, bleeding) → urgent instantly', { logged: true }),
        r('Gemini', 'Classify', 'ai', 'auto', 'Category + urgency + confidence'),
        r('Fail-safe', 'Code', 'processing', 'auto', 'Unsure or low confidence → treat as urgent', { logged: true }),
        r('Duty nurse', 'Urgent gate', 'output', 'human', 'Gets urgent cases < 2 min; no AI reply to patient', { gate: true, logged: true }),
        r('Gemini', 'Draft routine', 'ai', 'auto', 'Draft reply: appointments, timings'),
        r('Front desk', 'Routine gate', 'output', 'human', 'One-tap approve / edit', { gate: true, logged: true }),
        r('Policy', 'Privacy', 'context', 'human', 'Minimal data stored, role-based access, retention limit'),
        r('Neon', 'Audit log', 'output', 'auto', 'Every message, label, reason, who acted'),
        r('Dr Mehra', 'Audit + evals', 'output', 'human', 'Weekly audit; eval set: zero missed urgent cases'),
      ],
      flows: 'Patient → WhatsApp API → code safety screen (urgent words skip the AI) → Gemini classifies → fail-safe (unsure → urgent) → urgent: duty nurse within 2 min, no AI reply / routine: Gemini drafts → front desk approves → reply sent. Everything logged to Neon; Dr Mehra audits and runs evals.',
    },
    checks: [
      { label: 'Urgent cases go to a nurse with no AI reply to the patient', test: (m) => has(m, /nurse/) && has(m, /no ai|without ai|no reply|not reply|human only/),
        tip: 'Write it explicitly: urgent → duty nurse, and the AI never replies to the patient on those.' },
      { label: 'A fail-safe: unsure means more urgent, not less', test: (m) => has(m, /unsure|uncertain|confidence|fail.?safe|escalat|default/),
        tip: 'When the classifier is unsure, the safe failure is to escalate. A missed emergency costs far more than an extra nurse check.' },
      { label: 'Two different human gates (nurse for urgent, front desk for routine)', test: (m) => gates(m) >= 2,
        tip: 'Urgent and routine have different owners: mark both as review gates.' },
      { label: 'A rules-based safety screen before (or alongside) the AI', test: (m) => hasIn(m, 'processing', /keyword|word|rule|red.?flag|screen/),
        tip: 'Obvious emergencies should be caught by simple, testable rules in code, not left only to a model.' },
      { label: 'Privacy is addressed', test: (m) => has(m, /privacy|consent|access|retention|minimal|pii/), tip: 'Health data: say what is stored, who can see it and for how long.' },
      { label: 'Audit and evals for missed urgent cases', test: (m) => has(m, /eval|audit|test/) && logged(m) >= 1,
        tip: 'Dr Mehra needs an audit log and an eval set proving urgent cases are never missed.' },
    ],
  },
  {
    id: 'rental-agent',
    title: 'Late-payment agent',
    level: 5,
    closest: 'Session 6: agents with tools',
    situation: `A furniture-rental company has 3,000 customers a month who pay late. Today an agent calls each one. The company wants
an AI agent that sends a reminder, reads the reply (“paid already”, “salary on 5th”, “furniture is broken”, “stop messaging me”) and
acts: checks the payment system, offers a date change once, raises a repair ticket, or hands over to a human.`,
    ask: `An agent with tools: check payment status, propose a new date, create a repair ticket, update the CRM, escalate to a human.
Rules: at most 3 messages per customer per week; never threaten; any dispute over ₹10,000 or any legal word (“consumer court”,
“lawyer”) goes to a human immediately.`,
    think: ['It is not a fixed pipeline: the next step depends on the reply.', 'What is in the state object?',
      'Which tools belong to someone else (payment API, CRM)?', 'What retries on a timeout and what stops on a permanent failure?',
      'Where is the kill switch?'],
    model: {
      rows: [
        r('Scheduler', 'Daily', 'trigger', 'auto', 'Overdue accounts each morning'),
        r('Customer', 'Replies', 'input', 'human', 'Reply on WhatsApp / SMS'),
        r('State object', 'Per customer', 'context', 'auto', 'reply_status, promised_date, msgs_this_week, date_change_used, round'),
        r('Payment API', 'Vendor tool', 'context', 'auto', 'check_payment (someone else’s tool)'),
        r('Guardrails', 'Code, no AI', 'processing', 'auto', '≤3 msgs/week, no threats, ₹10k+ or legal words → human', { logged: true }),
        r('Agent', 'Gemini', 'ai', 'auto', 'Reads reply + state, picks next tool'),
        r('Tools', 'Actions', 'processing', 'auto', 'propose_date (once), create_repair_ticket, update_crm, escalate'),
        r('Retry table', 'Code', 'processing', 'auto', 'Timeout → retry ×2 with backoff; permanent error → stop + escalate'),
        r('Collections agent', 'Human gate', 'output', 'human', 'Handles disputes, legal words, escalations', { gate: true, logged: true }),
        r('Messages', 'To customer', 'output', 'auto', 'Reminder / date offer / confirmation'),
        r('Ops lead', 'Kill switch', 'output', 'human', 'Complaint or escalation rate over limit → pause agent'),
        r('Neon', 'Log', 'output', 'auto', 'Every message, tool call, decision'),
      ],
      flows: 'Scheduler → agent reads state → guardrails check caps and legal/₹10k triggers first (→ human) → agent chooses a tool (check payment / propose date once / repair ticket / update CRM) → tool result updates state → reply to customer → customer replies → loop. Retry table on tool failures. Everything logged; ops lead holds the kill switch.',
    },
    checks: [
      { label: 'A state object tracks the conversation', test: (m) => has(m, /state|promised|round|status/), tip: 'Agents need a compact state (reply status, promised date, messages this week), not the whole chat history.' },
      { label: 'Message caps and the once-only date change are enforced', test: (m) => has(m, /3|cap|limit|once/), tip: '≤3 messages per week and one date change are business rules: enforce them in code, not in the prompt alone.' },
      { label: 'Legal words or ₹10k+ disputes go straight to a human', test: (m) => has(m, /legal|lawyer|court|10.?k|10,000|10000/) && gates(m) >= 1,
        tip: 'Write the escalation triggers and mark the human handler as a review gate.' },
      { label: 'Transient vs permanent failures handled (retry table)', test: (m) => has(m, /retry|timeout|backoff|permanent/), tip: 'Timeouts retry with backoff a limited number of times; permanent errors stop and escalate.' },
      { label: 'Tools are listed (incl. someone else’s, like the payment API / CRM)', test: (m) => has(m, /tool|crm|ticket|payment/), tip: 'Name each tool the agent can call; note which ones you don’t control.' },
      { label: 'A kill switch exists', test: (m) => has(m, /kill|pause|stop the agent|switch off/), tip: 'Someone must be able to pause the agent when complaints or escalations spike.' },
    ],
  },
];

// ---- helpers used by the checks ----
const cellsOf = (m) => m.rows.flatMap((row) => Object.entries(row.cells || {}).map(([col, c]) => ({ col, ...c, row })));
const allText = (m) => [m.flows || '', ...m.rows.map((r) => `${r.actor} ${r.sub}`), ...cellsOf(m).map((c) => c.text || '')].join(' ').toLowerCase();
function has(m, re) { return re.test(allText(m)); }
function hasIn(m, col, re) { return cellsOf(m).some((c) => c.col === col && re.test((c.text || '').toLowerCase())); }
function aiUsed(m) { return cellsOf(m).some((c) => c.col === 'ai' && (c.text || '').trim() && c.kind !== 'none'); }
function gates(m) { return m.rows.filter((r) => r.gate).length; }
function logged(m) { return m.rows.filter((r) => r.logged).length; }

/** Checks for a case run on the client (the tests are functions, so they stay in this module). */
export function grade(caseId, map) {
  const c = CASES.find((x) => x.id === caseId);
  const base = [
    { label: 'Every filled cell is tagged Automated, Human or Not used', ok: cellsOf(map).filter((x) => (x.text || '').trim()).every((x) => x.kind),
      tip: 'Colour tells the reader who does the work; tag every box.' },
  ];
  return [...base, ...c.checks.map((k) => ({ label: k.label, ok: Boolean(k.test(map)), tip: k.tip }))];
}
