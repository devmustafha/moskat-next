import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Permissions for Better Auth's admin endpoints (/api/auth/admin/*).
 * Site areas are protected separately by the guards in lib/auth/session.ts.
 *
 * Admins manage accounts but can never impersonate: impersonating a doctor would let an
 * admin read clinical data. Accounts are never deleted (ban instead), and emails can't be
 * changed by admins.
 */
export const ac = createAccessControl(defaultStatements);

export const authRoles = {
  patient: ac.newRole({ user: [], session: [] }),
  doctor: ac.newRole({ user: [], session: [] }),
  admin: ac.newRole({
    user: ["create", "list", "get", "set-role", "ban", "set-password"],
    session: ["list", "revoke"],
  }),
};
