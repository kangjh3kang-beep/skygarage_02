import { useCallback } from 'react';
import { useAuth } from '../admin/contexts/AuthContext';
import { checkPermission, mapLegacyRole, findClosestRouteAccess } from '../domain';
import type { AdminRole, MenuGroup, PermissionLevel } from '../domain';
import { appendAuditEvent } from '../admin/services/auditChain';

export function useDomainPermission() {
  const { role, user } = useAuth();

  const adminRole: AdminRole = role ? mapLegacyRole(role) : 'OPERATOR';

  const hasPermission = useCallback((group: MenuGroup, level: PermissionLevel): boolean => {
    return checkPermission(adminRole, group, level);
  }, [adminRole]);

  const canAccessRoute = useCallback((path: string): boolean => {
    const access = findClosestRouteAccess(path);
    if (!access) return true;
    return checkPermission(adminRole, access.group, access.level);
  }, [adminRole]);

  const emitAudit = useCallback(async (
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, unknown>
  ) => {
    if (!user) return;
    try {
      await appendAuditEvent({
        siteId: 'default',
        actorId: user.id,
        action,
        resource,
        resourceId,
        details,
      });
    } catch {
      // Audit failure should not block the operation
    }
  }, [user]);

  return { adminRole, hasPermission, canAccessRoute, emitAudit };
}
