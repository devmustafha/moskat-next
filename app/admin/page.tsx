import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";

/** The admin area starts at bookings. */
export default async function AdminPage() {
  await requireAdmin("/admin");
  redirect("/admin/bookings");
}
