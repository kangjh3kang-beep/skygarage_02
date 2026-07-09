export type AdminRole =
  | 'OPERATOR'
  | 'FACILITY_ADMIN'
  | 'SECURITY_ADMIN'
  | 'SETTLEMENT_ADMIN'
  | 'CONTROL_CENTER'
  | 'SUPER_ADMIN'
  | 'PARTNER_ADMIN'
  | 'PLATFORM_OPS';

export type PermissionLevel = 'R' | 'W' | 'A';

export type MenuGroup =
  | 'A' | 'B' | 'M' | 'C' | 'D' | 'D!' | 'D!s' | 'D!r'
  | 'E' | 'F' | 'G' | 'H' | 'I' | 'I!' | 'J'
  | 'K0' | 'K1' | 'K2' | 'K3' | 'BW' | 'CC';

const PERMISSION_MATRIX: Record<MenuGroup, Partial<Record<AdminRole, PermissionLevel>>> = {
  'A':    { OPERATOR: 'W', FACILITY_ADMIN: 'R', SECURITY_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PLATFORM_OPS: 'R' },
  'B':    { OPERATOR: 'W', FACILITY_ADMIN: 'W', SECURITY_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PLATFORM_OPS: 'R' },
  'M':    { OPERATOR: 'W', SECURITY_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A' },
  'C':    { OPERATOR: 'R', FACILITY_ADMIN: 'W', SECURITY_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PARTNER_ADMIN: 'R', PLATFORM_OPS: 'R' },
  'D':    { OPERATOR: 'R', FACILITY_ADMIN: 'R', SECURITY_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PLATFORM_OPS: 'R' },
  'D!':   { OPERATOR: 'W', FACILITY_ADMIN: 'W', SECURITY_ADMIN: 'A', CONTROL_CENTER: 'W', SUPER_ADMIN: 'A' },
  'D!s':  { OPERATOR: 'W', FACILITY_ADMIN: 'W', SECURITY_ADMIN: 'A', CONTROL_CENTER: 'W', SUPER_ADMIN: 'A' },
  'D!r':  { SECURITY_ADMIN: 'A', SUPER_ADMIN: 'A' },
  'E':    { OPERATOR: 'W', FACILITY_ADMIN: 'W', SECURITY_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PLATFORM_OPS: 'W' },
  'F':    { OPERATOR: 'W', FACILITY_ADMIN: 'R', SECURITY_ADMIN: 'R', CONTROL_CENTER: 'W', SUPER_ADMIN: 'A', PLATFORM_OPS: 'R' },
  'G':    { OPERATOR: 'R', FACILITY_ADMIN: 'W', SECURITY_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PARTNER_ADMIN: 'R', PLATFORM_OPS: 'R' },
  'H':    { OPERATOR: 'R', FACILITY_ADMIN: 'R', SECURITY_ADMIN: 'A', SETTLEMENT_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PLATFORM_OPS: 'R' },
  'I':    { SECURITY_ADMIN: 'R', SETTLEMENT_ADMIN: 'W', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PARTNER_ADMIN: 'R', PLATFORM_OPS: 'R' },
  'I!':   { SETTLEMENT_ADMIN: 'A', SUPER_ADMIN: 'A' },
  'J':    { OPERATOR: 'R', FACILITY_ADMIN: 'R', SECURITY_ADMIN: 'R', SETTLEMENT_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PARTNER_ADMIN: 'R', PLATFORM_OPS: 'W' },
  'K0':   { SUPER_ADMIN: 'A', PLATFORM_OPS: 'R' },
  'K1':   { SUPER_ADMIN: 'A', PLATFORM_OPS: 'R' },
  'K2':   { SECURITY_ADMIN: 'W', SUPER_ADMIN: 'A', PLATFORM_OPS: 'R' },
  'K3':   { SECURITY_ADMIN: 'W', SUPER_ADMIN: 'A', PLATFORM_OPS: 'R' },
  'BW':   { OPERATOR: 'W', FACILITY_ADMIN: 'W', SECURITY_ADMIN: 'R', CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PLATFORM_OPS: 'W' },
  'CC':   { CONTROL_CENTER: 'R', SUPER_ADMIN: 'A', PLATFORM_OPS: 'W' },
};

const LEVEL_HIERARCHY: Record<PermissionLevel, number> = { R: 1, W: 2, A: 3 };

export function checkPermission(
  role: AdminRole,
  group: MenuGroup,
  requiredLevel: PermissionLevel
): boolean {
  const granted = PERMISSION_MATRIX[group]?.[role];
  if (!granted) return false;
  return LEVEL_HIERARCHY[granted] >= LEVEL_HIERARCHY[requiredLevel];
}

export function getPermissionLevel(role: AdminRole, group: MenuGroup): PermissionLevel | null {
  return PERMISSION_MATRIX[group]?.[role] ?? null;
}

export function mapLegacyRole(legacy: string): AdminRole {
  switch (legacy) {
    case 'super_admin': return 'SUPER_ADMIN';
    case 'admin': return 'PLATFORM_OPS';
    case 'manager': return 'OPERATOR';
    case 'operator': return 'FACILITY_ADMIN';
    case 'viewer': return 'OPERATOR';
    default: return 'OPERATOR';
  }
}
