"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { Page, PageHeader } from "./PageHeader";
import { Skeleton } from "./Skeleton";
import { StatusPill } from "./StatusPill";
import { useToast } from "./Toast";
import { COPY } from "../lib/copy";
import { ERROR_CODES } from "../lib/errors";

type Reminder = {
  id: string;
  patientName: string;
  channel: string;
  dueAt: string;
  note: string;
  status: string;
};

function pillStatus(status: string) {
  if (status === "complete") return "complete";
  if (status === "due") return "ready";
  return "paused";
}

function formatDue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function RemindersPanel() {
  const toast = useToast();
  const [, setTick] = useState(0);
  // @fireweave-controlpoint reminders
  const enabled = fw.controlPoints.getBooleanValue("reminders", false);
  const [rows, setRows] = useState<Reminder[] | null>(null);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState({
    patientName: "",
    channel: "call",
    dueAt: "",
    note: "",
  });

  useEffect(() => fw.subscribe(() => setTick((n) => n + 1)), []);

  async function load() {
    const res = await fetch("/api/reminders");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (res.status === 404) {
      setRows([]);
      return;
    }
    if (!res.ok) return;
    setRows((await res.json()) as Reminder[]);
  }

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled]);

  if (!enabled) {
    return (
      <Page>
        <PageHeader title="Reminders" subtitle={<span className="muted">Not turned on for this clinic yet.</span>} />
        <EmptyState title={COPY.remindersOff} />
      </Page>
    );
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    setPending(false);
    if (!res.ok) {
      toast.push({ tone: "error", title: COPY.reminderCreateFailed, code: ERROR_CODES.SUBMIT_BLOCKED });
      return;
    }
    const created = (await res.json()) as Reminder;
    setRows((current) => [created, ...(current ?? []).filter((row) => row.id !== created.id)]);
    setDraft({ patientName: "", channel: "call", dueAt: "", note: "" });
  }

  async function complete(id: string) {
    setBusy(id);
    const res = await fetch(`/api/reminders/${id}/complete`, { method: "POST" });
    setBusy("");
    if (!res.ok) {
      toast.push({ tone: "error", title: COPY.reminderCompleteFailed, code: ERROR_CODES.RUNNER_REFUSED });
      return;
    }
    const updated = (await res.json()) as Reminder;
    setRows((current) => (current ?? []).map((row) => (row.id === updated.id ? updated : row)));
  }

  const loaded = rows !== null;
  const open = (rows ?? []).filter((row) => row.status !== "complete");
  const done = (rows ?? []).filter((row) => row.status === "complete");

  return (
    <Page>
      <PageHeader
        title="Reminders"
        subtitle={
          <span className="mono muted">{loaded ? `${open.length} due · ${done.length} done` : "—"}</span>
        }
      />

      <form className="card stack section" onSubmit={(event) => void create(event)}>
        <div className="section-head">
          <h2>Schedule a reminder</h2>
        </div>
        <div className="fields">
          <div>
            <label htmlFor="reminder-patient">Patient</label>
            <input
              id="reminder-patient"
              value={draft.patientName}
              onChange={(event) => setDraft((current) => ({ ...current, patientName: event.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="reminder-channel">Channel</label>
            <select
              id="reminder-channel"
              value={draft.channel}
              onChange={(event) => setDraft((current) => ({ ...current, channel: event.target.value }))}
            >
              <option value="call">Call</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <div>
            <label htmlFor="reminder-due">Due</label>
            <input
              id="reminder-due"
              type="datetime-local"
              value={draft.dueAt}
              onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))}
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="reminder-note">Note</label>
          <input
            id="reminder-note"
            value={draft.note}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
            placeholder="Confirm ride, prep instructions…"
          />
        </div>
        <Button variant="primary" type="submit" loading={pending}>
          Add reminder
        </Button>
      </form>

      {!loaded ? <Skeleton /> : null}

      {loaded && rows.length === 0 ? <EmptyState title={COPY.emptyReminders} /> : null}

      {open.length > 0 ? (
        <div className="section">
          <table>
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Channel</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
                <th scope="col"> </th>
              </tr>
            </thead>
            <tbody>
              {open.map((row) => (
                <tr key={row.id}>
                  <td>
                    <h2 className="patient">{row.patientName}</h2>
                    {row.note ? <p className="missing">{row.note}</p> : null}
                  </td>
                  <td className="mono">{row.channel}</td>
                  <td className="mono">{formatDue(row.dueAt)}</td>
                  <td>
                    <StatusPill status={pillStatus(row.status)} />
                  </td>
                  <td>
                    <Button variant="secondary" size="sm" loading={busy === row.id} onClick={() => void complete(row.id)}>
                      Mark done
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Page>
  );
}
