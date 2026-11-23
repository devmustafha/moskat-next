import { describe, expect, it } from "vitest";
import type { BookingStatus } from "@/lib/db/schema";
import { attendanceSummary, type CallAttendance, decideEnd, formatCallDuration, isPresent, planClose, secondsBetween } from "./lifecycle";

const startsAt = new Date("2026-11-20T09:00:00Z"); // 10:00 am in Lagos
const endsAt = new Date("2026-11-20T09:30:00Z");
const hardStop = new Date("2026-11-20T09:45:00Z"); // end + 15 min grace
const at = (hhmm: string) => new Date(`2026-11-20T${hhmm}:00Z`);
const config = { joinOpensMinutesBefore: 10, lateJoinMinutesAfterStart: 30, graceMinutesAfterEnd: 15, tokenTtlSeconds: 600 };

const empty: CallAttendance = { doctorJoinedAt: null, patientJoinedAt: null, doctorLeftAt: null, patientLeftAt: null, startedAt: null, endedAt: null };
const call = (fields: Partial<CallAttendance>): CallAttendance => ({ ...empty, ...fields });
/** Both joined, the call started at 09:02. */
const started = call({ doctorJoinedAt: at("08:58"), patientJoinedAt: at("09:02"), startedAt: at("09:02") });

describe("isPresent", () => {
  it("is true from a join until a leave, and again after a rejoin clears the leave", () => {
    expect(isPresent(empty, "doctor")).toBe(false);
    expect(isPresent(call({ doctorJoinedAt: at("09:00") }), "doctor")).toBe(true);
    expect(isPresent(call({ doctorJoinedAt: at("09:00"), doctorLeftAt: at("09:10") }), "doctor")).toBe(false);
    expect(isPresent(call({ doctorJoinedAt: at("09:00") }), "patient")).toBe(false);
  });
});

describe("secondsBetween", () => {
  it("rounds to whole seconds and is never negative", () => {
    expect(secondsBetween(at("09:00"), at("09:24"))).toBe(24 * 60);
    expect(secondsBetween(at("09:10"), at("09:00"))).toBe(0);
  });
});

describe("decideEnd", () => {
  const now = at("09:26");

  it("lets the doctor end a started call, with its duration so far", () => {
    expect(decideEnd({ role: "doctor", status: "in_progress", call: started, now })).toEqual({ ok: true, durationSeconds: 24 * 60 });
  });

  it("refuses the patient", () => {
    expect(decideEnd({ role: "patient", status: "in_progress", call: started, now })).toEqual({ ok: false, reason: "doctor_only" });
  });

  it("refuses until the patient has been in the call, so the doctor can't lock them out early", () => {
    expect(decideEnd({ role: "doctor", status: "confirmed", call: call({ doctorJoinedAt: at("08:55") }), now })).toEqual({ ok: false, reason: "not_started" });
    expect(decideEnd({ role: "doctor", status: "confirmed", call: null, now })).toEqual({ ok: false, reason: "not_started" });
  });

  it("is harmless to repeat once ended", () => {
    expect(decideEnd({ role: "doctor", status: "completed", call: { ...started, endedAt: at("09:20") }, now })).toEqual({ ok: false, reason: "already_ended" });
  });

  it("refuses bookings that aren't active", () => {
    for (const status of ["cancelled", "pending_payment", "no_show", "completed"] as const) {
      expect(decideEnd({ role: "doctor", status, call: started, now })).toEqual({ ok: false, reason: "not_active" });
    }
  });
});

describe("planClose", () => {
  const after = at("09:50");
  const base = { endsAt, now: after, paid: true };

  it("does nothing before the hard stop", () => {
    expect(planClose({ ...base, status: "in_progress", call: started, now: at("09:44") }, config)).toBeNull();
  });

  it("completes a started call, ending it when the last person left", () => {
    const c = { ...started, doctorLeftAt: at("09:25"), patientLeftAt: at("09:27") };
    expect(planClose({ ...base, status: "in_progress", call: c }, config)).toEqual({
      callEnd: { endedAt: at("09:27"), durationSeconds: 25 * 60 },
      booking: "completed",
    });
  });

  it("ends at the hard stop when someone never said they left", () => {
    const plan = planClose({ ...base, status: "in_progress", call: { ...started, patientLeftAt: at("09:20") } }, config);
    expect(plan?.callEnd).toEqual({ endedAt: hardStop, durationSeconds: 43 * 60 });
  });

  it("never ends after the hard stop, even if a leave arrived later", () => {
    const c = { ...started, doctorLeftAt: at("09:48"), patientLeftAt: at("09:47") };
    expect(planClose({ ...base, status: "in_progress", call: c }, config)?.callEnd?.endedAt).toEqual(hardStop);
  });

  it("marks the booking missed when the doctor joined and the patient never did", () => {
    const c = call({ doctorJoinedAt: at("08:55"), doctorLeftAt: at("09:31") });
    expect(planClose({ ...base, status: "confirmed", call: c }, config)).toEqual({ callEnd: { endedAt: at("09:31"), durationSeconds: null }, booking: "no_show" });
  });

  it("leaves the booking for staff when the doctor never joined (the call is still closed)", () => {
    const c = call({ patientJoinedAt: at("09:01"), patientLeftAt: at("09:20") });
    expect(planClose({ ...base, status: "confirmed", call: c }, config)).toEqual({ callEnd: { endedAt: at("09:20"), durationSeconds: null }, booking: null });
  });

  it("leaves the booking for staff when both joined but never at the same time", () => {
    const c = call({ doctorJoinedAt: at("08:55"), doctorLeftAt: at("08:58"), patientJoinedAt: at("09:05"), patientLeftAt: at("09:15") });
    expect(planClose({ ...base, status: "confirmed", call: c }, config)?.booking).toBeNull();
  });

  it("doesn't touch bookings without online payment, or an already ended call", () => {
    expect(planClose({ ...base, paid: false, status: "confirmed", call: call({ doctorJoinedAt: at("09:00") }) }, config)?.booking).toBeNull();
    expect(planClose({ ...base, status: "completed", call: { ...started, endedAt: at("09:20") } }, config)).toEqual({ callEnd: null, booking: null });
  });
});

describe("formatCallDuration", () => {
  it("speaks in minutes and hours", () => {
    expect(formatCallDuration(20)).toBe("under a minute");
    expect(formatCallDuration(24 * 60 + 10)).toBe("24 min");
    expect(formatCallDuration(65 * 60)).toBe("1 h 5 min");
    expect(formatCallDuration(120 * 60)).toBe("2 h");
  });
});

describe("attendanceSummary", () => {
  const tz = "Africa/Lagos";
  const booking: { status: BookingStatus; startsAt: Date; endsAt: Date; paid: boolean } = { status: "confirmed", startsAt, endsAt, paid: true };
  const extra: { endedBy: "doctor" | "system" | null; durationSeconds: number | null } = { endedBy: null, durationSeconds: null };
  const summary = (b: Partial<typeof booking>, c: Partial<CallAttendance & typeof extra> | null, now: Date) =>
    attendanceSummary({ ...booking, ...b }, c && { ...empty, ...extra, ...c }, tz, now, config);

  it("says nothing for bookings without video, cancelled ones, or before anyone joined", () => {
    expect(summary({ paid: false }, null, at("10:00"))).toBeNull();
    expect(summary({ status: "cancelled" }, null, at("10:00"))).toBeNull();
    expect(summary({}, null, at("09:05"))).toBeNull();
  });

  it("gives the duration and who ended a finished call", () => {
    expect(summary({ status: "completed" }, { ...started, endedAt: at("09:26"), endedBy: "doctor", durationSeconds: 24 * 60 }, at("10:00"))).toEqual({
      text: "Video call: 24 min, ended by the doctor",
      alert: false,
    });
  });

  it("shows a call in progress, in the doctor's time zone", () => {
    expect(summary({ status: "in_progress" }, started, at("09:10"))?.text).toBe("Video call in progress since 10:02 am");
  });

  it("flags a closed call the doctor never joined", () => {
    const s = summary({}, { patientJoinedAt: at("09:01") }, at("09:50"));
    expect(s?.alert).toBe(true);
    expect(s?.text).toContain("The doctor didn’t join");
    expect(summary({}, null, at("09:50"))?.alert).toBe(true);
  });

  it("notes a patient who never joined, without flagging it", () => {
    expect(summary({ status: "no_show" }, { doctorJoinedAt: at("08:55") }, at("09:50"))).toEqual({ text: "The patient didn’t join the video call.", alert: false });
  });
});
