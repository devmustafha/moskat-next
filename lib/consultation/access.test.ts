import { describe, expect, it } from "vitest";
import { type AccessInput, AGORA_UID, decideAccess, tokenLifetimeSeconds } from "./access";

const config = { joinOpensMinutesBefore: 10, lateJoinMinutesAfterStart: 30, graceMinutesAfterEnd: 15, tokenTtlSeconds: 600 };

const startsAt = new Date("2026-11-20T10:00:00Z");
const endsAt = new Date("2026-11-20T11:00:00Z"); // a 60-minute consultation
const at = (minutesFromStart: number) => new Date(startsAt.getTime() + minutesFromStart * 60_000);

function input(overrides: Partial<Omit<AccessInput, "booking">> & { booking?: Partial<AccessInput["booking"]> } = {}): AccessInput {
  return {
    role: "patient",
    call: null,
    now: at(0),
    ...overrides,
    booking: { status: "confirmed", startsAt, endsAt, paid: true, ...overrides.booking },
  };
}

describe("decideAccess", () => {
  it("lets the patient and the doctor in during the window", () => {
    expect(decideAccess(input({ role: "patient" }), config)).toMatchObject({ ok: true });
    expect(decideAccess(input({ role: "doctor" }), config)).toMatchObject({ ok: true });
    expect(decideAccess(input({ booking: { status: "in_progress" } }), config)).toMatchObject({ ok: true });
  });

  it("refuses unpaid, cancelled and finished bookings", () => {
    expect(decideAccess(input({ booking: { status: "pending_payment" } }), config)).toEqual({ ok: false, reason: "not_paid" });
    expect(decideAccess(input({ booking: { paid: false } }), config)).toEqual({ ok: false, reason: "not_paid" });
    expect(decideAccess(input({ booking: { status: "cancelled" } }), config)).toEqual({ ok: false, reason: "cancelled" });
    expect(decideAccess(input({ booking: { status: "completed" } }), config)).toEqual({ ok: false, reason: "ended" });
    expect(decideAccess(input({ booking: { status: "no_show" } }), config)).toEqual({ ok: false, reason: "ended" });
  });

  it("refuses a call the doctor has ended, even inside the window", () => {
    const call = { endedAt: at(20), doctorJoinedAt: at(0), patientJoinedAt: at(1) };
    expect(decideAccess(input({ call, now: at(25) }), config)).toEqual({ ok: false, reason: "ended" });
  });

  it("opens 10 minutes before the start", () => {
    expect(decideAccess(input({ now: at(-11) }), config)).toEqual({ ok: false, reason: "too_early", opensAt: at(-10) });
    expect(decideAccess(input({ now: at(-10) }), config)).toMatchObject({ ok: true });
  });

  it("refuses a first join more than 30 minutes after the start", () => {
    expect(decideAccess(input({ now: at(30) }), config)).toMatchObject({ ok: true });
    expect(decideAccess(input({ now: at(31) }), config)).toEqual({ ok: false, reason: "closed" });
    // The other participant having joined doesn't let this one in late.
    const call = { endedAt: null, doctorJoinedAt: at(0), patientJoinedAt: null };
    expect(decideAccess(input({ role: "patient", call, now: at(31) }), config)).toEqual({ ok: false, reason: "closed" });
  });

  it("lets someone who joined renew or reconnect until the end plus 15 minutes", () => {
    const call = { endedAt: null, doctorJoinedAt: at(-5), patientJoinedAt: at(2) };
    expect(decideAccess(input({ role: "patient", call, now: at(45) }), config)).toMatchObject({ ok: true });
    expect(decideAccess(input({ role: "doctor", call, now: at(74) }), config)).toMatchObject({ ok: true, hardStopAt: at(75) });
    expect(decideAccess(input({ role: "doctor", call, now: at(75) }), config)).toEqual({ ok: false, reason: "closed" });
  });

  it("uses the configured window", () => {
    const wide = { ...config, joinOpensMinutesBefore: 30, lateJoinMinutesAfterStart: 5, graceMinutesAfterEnd: 0 };
    expect(decideAccess(input({ now: at(-25) }), wide)).toMatchObject({ ok: true });
    expect(decideAccess(input({ now: at(6) }), wide)).toEqual({ ok: false, reason: "closed" });
    const call = { endedAt: null, doctorJoinedAt: at(0), patientJoinedAt: at(0) };
    expect(decideAccess(input({ call, now: at(60) }), wide)).toEqual({ ok: false, reason: "closed" });
  });
});

describe("tokenLifetimeSeconds", () => {
  const hardStopAt = at(75);

  it("uses the configured TTL when the hard stop is far away", () => {
    expect(tokenLifetimeSeconds(at(0), hardStopAt, config)).toBe(600);
  });

  it("never outlives the hard stop", () => {
    expect(tokenLifetimeSeconds(at(70), hardStopAt, config)).toBe(300);
  });

  it("lasts at least a minute", () => {
    expect(tokenLifetimeSeconds(at(74.9), hardStopAt, config)).toBe(60);
  });

  it("caps at Agora's 24-hour maximum", () => {
    expect(tokenLifetimeSeconds(at(0), new Date(at(0).getTime() + 3 * 86_400_000), { tokenTtlSeconds: 999_999 })).toBe(86_400);
  });
});

describe("AGORA_UID", () => {
  it("gives the doctor and the patient different, valid uids", () => {
    expect(AGORA_UID.doctor).not.toBe(AGORA_UID.patient);
    for (const uid of Object.values(AGORA_UID)) expect(uid >= 1 && uid <= 2 ** 32 - 1).toBe(true);
  });
});
