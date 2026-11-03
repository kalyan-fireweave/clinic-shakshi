CREATE TABLE IF NOT EXISTS reminders (
  id text PRIMARY KEY,
  clinic_id text NOT NULL REFERENCES clinics(id),
  referral_id text REFERENCES referrals(id),
  patient_name text NOT NULL,
  channel text NOT NULL,
  due_at timestamptz NOT NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reminders TO clinic_app;

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reminders_tenant ON reminders;
CREATE POLICY reminders_tenant ON reminders
  USING (clinic_id = current_setting('app.clinic_id', true))
  WITH CHECK (clinic_id = current_setting('app.clinic_id', true));
