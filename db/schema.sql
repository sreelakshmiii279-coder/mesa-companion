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
