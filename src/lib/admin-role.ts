export type AdminRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "operator"
  | "viewer";
const roles = new Set([
  "super_admin",
  "admin",
  "manager",
  "operator",
  "viewer",
]);
export function trustedAdminRole(
  row: { role?: unknown } | null,
  error: unknown,
): AdminRole | null {
  return !error && row && typeof row.role === "string" && roles.has(row.role)
    ? (row.role as AdminRole)
    : null;
}
export function adminLoginIdentifier(value: string) {
  const input = value.trim();
  const phone = input.replace(/[\s-]/g, "");
  return /^010\d{8}$/.test(phone) ? `${phone}@sgp.skygarage.app` : input;
}
