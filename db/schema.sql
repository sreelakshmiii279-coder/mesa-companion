-- Mesa Companion schema. Safe to re-run (creates only what's missing).

CREATE TABLE IF NOT EXISTS assignments (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  course      text,
  description text,
  due_at      timestamptz,
  submitted   boolean NOT NULL DEFAULT false,
  marked_done boolean NOT NULL DEFAULT false,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id         text PRIMARY KEY,
  title      text NOT NULL,
  course     text,
  instructor text,
  room       text,
  start_at   timestamptz NOT NULL,
  end_at     timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recordings (
  id           text PRIMARY KEY,
  course       text NOT NULL,
  title        text NOT NULL,
  video_url    text NOT NULL,
  thumbnail    text,
  recorded_on  date,
  notes_md     text,
  notes_status text NOT NULL DEFAULT 'pending',  -- pending | done | error
  notes_error  text,
  attempts     int NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Your own planner tasks. repeat: none | daily | weekdays
CREATE TABLE IF NOT EXISTS tasks (
  id           serial PRIMARY KEY,
  title        text NOT NULL,
  day          date NOT NULL,            -- the day it happens (first day, for repeating tasks)
  start_time   time NOT NULL,            -- IST wall-clock time
  duration_min int NOT NULL DEFAULT 30,
  repeat       text NOT NULL DEFAULT 'none',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_done (
  task_id int NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  day     date NOT NULL,
  PRIMARY KEY (task_id, day)
);

CREATE TABLE IF NOT EXISTS push_subs (
  endpoint   text PRIMARY KEY,
  sub        jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- In-app notification feed; dedupe_key stops the same reminder going out twice.
CREATE TABLE IF NOT EXISTS notifications (
  id         serial PRIMARY KEY,
  dedupe_key text UNIQUE NOT NULL,
  kind       text NOT NULL,
  title      text NOT NULL,
  body       text,
  url        text,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta (
  key   text PRIMARY KEY,
  value text
);

-- Pre-reads and post-reads from the portal, with a Gemini summary.
CREATE TABLE IF NOT EXISTS readings (
  id             text PRIMARY KEY,
  course         text NOT NULL,
  kind           text NOT NULL,            -- pre | post
  title          text NOT NULL,
  file_name      text,
  file_type      text,
  link_url       text,                     -- for link-type materials
  body           text,                     -- for text-type materials (HTML stripped)
  summary_md     text,
  summary_status text NOT NULL DEFAULT 'pending',  -- pending | done | error | skip
  summary_error  text,
  attempts       int NOT NULL DEFAULT 0,
  is_read        boolean NOT NULL DEFAULT false,
  posted_at      timestamptz,
  first_seen     timestamptz NOT NULL DEFAULT now()
);

-- One row per news briefing (a handful of picked stories).
CREATE TABLE IF NOT EXISTS news (
  id         serial PRIMARY KEY,
  items      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vision board. kind: future | identity | goal | image
CREATE TABLE IF NOT EXISTS vision (
  id         serial PRIMARY KEY,
  kind       text NOT NULL,
  text       text,
  image_url  text,
  sort       int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Household chores / to-dos: the app finds a free slot in your day for each one.
CREATE TABLE IF NOT EXISTS chores (
  id          serial PRIMARY KEY,
  title       text NOT NULL,
  est_min     int NOT NULL DEFAULT 20,
  due_day     date,                 -- finish by this IST day (optional)
  slot_start  timestamptz,          -- when the app scheduled it
  done        boolean NOT NULL DEFAULT false,
  moves       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Type and priority for your own tasks (fixed-time) and chores (auto-slotted).
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
ALTER TABLE chores ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'house';
ALTER TABLE chores ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
-- "Later" on an auto-slotted task: don't place it before this time.
ALTER TABLE chores ADD COLUMN IF NOT EXISTS not_before timestamptz;

-- Tasks created automatically from portal assignments.
ALTER TABLE chores ADD COLUMN IF NOT EXISTS assignment_id text UNIQUE;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS due_at timestamptz;          -- exact deadline (slot must end before it)
ALTER TABLE chores ADD COLUMN IF NOT EXISTS auto_priority boolean NOT NULL DEFAULT false;  -- priority follows urgency until you change it
ALTER TABLE chores ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;         -- you deleted an auto task: keep it gone
