/** UI availability only. Database roles, RLS and MFA remain the authority. */
export const adminAvailableRoutes = [
  '/admin', '/admin/templates', '/admin/implementation', '/admin/governance',
  '/admin/settlement', '/admin/erp', '/admin/validation', '/admin/start',
  '/admin/complexes', '/admin/residents',
] as const;

export function normalizePath(path: string): string {
  return path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
}

export function isAdminPageAvailable(path: string): boolean {
  return (adminAvailableRoutes as readonly string[]).includes(normalizePath(path));
}

export function adminPageMode(path: string): 'available' | 'sandbox' | 'commissioning' {
  const route = normalizePath(path);
  if (!isAdminPageAvailable(route)) return 'commissioning';
  return ['/admin/settlement', '/admin/erp'].includes(route) ? 'sandbox' : 'available';
}
