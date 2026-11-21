import { and, eq, getTableName, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";

/** A Drizzle database or transaction handle. */
type Executor = Pick<Db, "update">;

/**
 * When a paid booking is cancelled (by the patient or the hospital), flag its payment for a
 * refund: `succeeded` → `needs_review` / `cancelled_after_payment`. Staff refund it in the Paystack
 * dashboard, then mark it refunded. Call inside the transaction that cancels the booking.
 * Returns true when there was a payment to refund.
 */
export async function flagPaymentForRefund(db: Executor, bookingId: string) {
  const flagged = await db
    .update(payments)
    .set({ status: "needs_review", reviewReason: "cancelled_after_payment" })
    .where(and(eq(payments.bookingId, bookingId), eq(payments.status, "succeeded")))
    .returning({ id: payments.id });
  return flagged.length > 0;
}

/**
 * The outer query's booking id column, always as "table"."column". Drizzle leaves columns
 * unqualified when a select has no joins, and inside a subquery on `payments` a bare "id" would
 * bind to payments.id instead, silently matching nothing.
 */
export function outerColumn(column: AnyPgColumn) {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}

/** SQL: whether money was taken for the booking (`bookingId` column), whatever happened after. */
export function bookingWasPaid(bookingId: AnyPgColumn) {
  return sql<boolean>`exists (select 1 from ${payments} where ${payments.bookingId} = ${outerColumn(bookingId)} and ${payments.paidAt} is not null)`;
}

/** SQL: whether the booking (`bookingId` column) is paid now: a succeeded payment, not refunded or under review. */
export function bookingIsPaid(bookingId: AnyPgColumn) {
  return sql<boolean>`exists (select 1 from ${payments} where ${payments.bookingId} = ${outerColumn(bookingId)} and ${payments.status} = 'succeeded')`;
}
