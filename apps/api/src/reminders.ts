import { desc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { fw } from "@fireweaveai/server-sdk/start";
import { reminders } from "@clinic/db";
import type { Staff } from "./authz";
import { withClinic } from "./db";

export async function remindersEnabled(userId: string) {
  // @fireweave-controlpoint reminders
  return fw.controlPoints.getBooleanValue("reminders", false, { targetingKey: userId });
}

export function registerReminders(app: Hono, staff: (c: { req: { raw: Request } }) => Promise<Staff | null>) {
  app.get("/api/reminders", async (c) => {
    const who = await staff(c);
    if (!who) return c.json({ error: "unauthorized" }, 401);
    if (!(await remindersEnabled(who.userId))) return c.json({ error: "not available" }, 404);
    const rows = await withClinic(who.clinicId, (tx) =>
      tx.select().from(reminders).where(eq(reminders.clinicId, who.clinicId)).orderBy(desc(reminders.dueAt)),
    );
    return c.json(rows);
  });

  app.post("/api/reminders", async (c) => {
    const who = await staff(c);
    if (!who) return c.json({ error: "unauthorized" }, 401);
    if (who.role === "auditor") return c.json({ error: "forbidden" }, 403);
    if (!(await remindersEnabled(who.userId))) return c.json({ error: "not available" }, 404);
    const body = await c.req.json<{
      patientName?: string;
      channel?: string;
      dueAt?: string;
      note?: string;
      referralId?: string | null;
    }>();
    const patientName = (body.patientName ?? "").trim();
    const channel = body.channel === "sms" ? "sms" : "call";
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    const note = (body.note ?? "").trim();
    if (!patientName || !dueAt || Number.isNaN(dueAt.getTime())) {
      return c.json({ error: "patient name and due date required" }, 400);
    }
    const row = {
      id: crypto.randomUUID(),
      clinicId: who.clinicId,
      referralId: body.referralId ?? null,
      patientName,
      channel,
      dueAt,
      note,
      status: "due",
    };
    await withClinic(who.clinicId, (tx) => tx.insert(reminders).values(row));
    return c.json(row, 201);
  });

  app.post("/api/reminders/:id/complete", async (c) => {
    const who = await staff(c);
    if (!who) return c.json({ error: "unauthorized" }, 401);
    if (who.role === "auditor") return c.json({ error: "forbidden" }, 403);
    if (!(await remindersEnabled(who.userId))) return c.json({ error: "not available" }, 404);
    const id = c.req.param("id");
    const updated = await withClinic(who.clinicId, async (tx) => {
      const [row] = await tx.select().from(reminders).where(eq(reminders.id, id));
      if (!row || row.status === "complete") return row ?? null;
      await tx.update(reminders).set({ status: "complete" }).where(eq(reminders.id, id));
      return { ...row, status: "complete" };
    });
    if (!updated) return c.json({ error: "missing" }, 404);
    return c.json(updated);
  });
}
