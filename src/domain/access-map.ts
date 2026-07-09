import type { MenuGroup, PermissionLevel } from './roles';

export interface RouteAccessEntry {
  group: MenuGroup;
  level: PermissionLevel;
  stepUp?: boolean;
  dualControl?: boolean;
}

export const ROUTE_ACCESS: Record<string, RouteAccessEntry | { public: true }> = {
  '/admin/login': { public: true },
  '/admin/mfa': { public: true },

  // A: Dashboard & Control
  '/admin': { group: 'A', level: 'R' },
  '/admin/operations': { group: 'A', level: 'R' },
  '/admin/realtime': { group: 'A', level: 'R' },
  '/admin/missions': { group: 'A', level: 'W' },
  '/admin/scheduler': { group: 'A', level: 'W' },
  '/admin/bottleneck-workbench': { group: 'BW', level: 'W' },
  '/admin/alerts': { group: 'A', level: 'R' },
  '/admin/incidents': { group: 'A', level: 'R' },

  // B: Resources
  '/admin/complexes': { group: 'B', level: 'W' },
  '/admin/parking': { group: 'B', level: 'W' },
  '/admin/parking-zones': { group: 'B', level: 'W' },
  '/admin/parking-bays': { group: 'B', level: 'W' },
  '/admin/pickup-zones': { group: 'B', level: 'W' },

  // M: Members
  '/admin/residents': { group: 'M', level: 'W' },
  '/admin/members/visitors': { group: 'M', level: 'W' },
  '/admin/members/corporate': { group: 'M', level: 'W' },
  '/admin/vehicles': { group: 'M', level: 'W' },
  '/admin/bulk-operations': { group: 'M', level: 'W' },

  // C: Devices
  '/admin/atr': { group: 'C', level: 'R' },
  '/admin/elevators': { group: 'C', level: 'R' },
  '/admin/fleet': { group: 'C', level: 'R' },
  '/admin/energy': { group: 'C', level: 'R' },
  '/admin/hardware': { group: 'C', level: 'W' },

  // D: Safety (read-only FSM)
  '/admin/safety': { group: 'D', level: 'R' },
  '/admin/safety/fsm': { group: 'D', level: 'R' },
  '/admin/safety/interlocks': { group: 'D', level: 'R' },
  '/admin/safety/command-guard': { group: 'D', level: 'R' },
  // D!s: Emergency Stop invoke (wide access)
  '/admin/safety/emergency': { group: 'D!s', level: 'W' },
  // D!r: Emergency Resume / STO Release (high barrier)
  '/admin/safety/motion-tokens': { group: 'D!r', level: 'A', stepUp: true },

  // E: Digital Twin
  '/admin/digital-twin': { group: 'E', level: 'R' },
  '/admin/digital-twin/simulation': { group: 'E', level: 'W' },

  // F: Reservations & Missions
  '/admin/priority-dispatch': { group: 'F', level: 'W' },
  '/admin/reservations': { group: 'F', level: 'W' },
  '/admin/pre-pull': { group: 'F', level: 'W' },

  // G: Maintenance
  '/admin/maintenance': { group: 'G', level: 'R' },
  '/admin/maintenance/tickets': { group: 'G', level: 'W' },
  '/admin/maintenance/predictive': { group: 'G', level: 'R' },

  // H: Audit & Governance
  '/admin/security': { group: 'H', level: 'R' },
  '/admin/activity': { group: 'H', level: 'R' },
  '/admin/audit/events': { group: 'H', level: 'R' },
  '/admin/audit/evidence-bundles': { group: 'H', level: 'A' },
  '/admin/audit/export': { group: 'H', level: 'A' },

  // I: Settlement
  '/admin/settlement': { group: 'I', level: 'R' },
  '/admin/partners': { group: 'I', level: 'R' },
  '/admin/billing': { group: 'I', level: 'R' },
  '/admin/settlement/approve': { group: 'I!', level: 'A', stepUp: true, dualControl: true },

  // J: Reports
  '/admin/analytics': { group: 'J', level: 'R' },
  '/admin/observability': { group: 'J', level: 'R' },
  '/admin/revenue': { group: 'J', level: 'R' },
  '/admin/esg': { group: 'J', level: 'R' },

  // K: Settings
  '/admin/audit/config': { group: 'K0', level: 'A', dualControl: true },
  '/admin/users': { group: 'K1', level: 'A', dualControl: true },
  '/admin/settings/alerts-policy': { group: 'K2', level: 'W' },
  '/admin/settings/site-context': { group: 'K3', level: 'W' },
  '/admin/settings': { group: 'K2', level: 'R' },
  '/admin/team': { group: 'K2', level: 'R' },
  '/admin/ai': { group: 'K2', level: 'R' },
  '/admin/workflows': { group: 'K2', level: 'W' },
  '/admin/images': { group: 'K2', level: 'R' },
  '/admin/projects': { group: 'K2', level: 'R' },
  '/admin/noc': { group: 'CC', level: 'R' },
  '/admin/system': { group: 'CC', level: 'R' },
  '/admin/regions': { group: 'CC', level: 'W' },

  // Complex Control
  '/admin/control-center': { group: 'CC', level: 'R' },
  '/admin/control-center/policy-templates': { group: 'CC', level: 'W' },
  '/admin/control-center/site-onboarding': { group: 'CC', level: 'W' },
  '/admin/control-center/benchmark': { group: 'CC', level: 'R' },

  // Misc
  '/admin/crm': { group: 'J', level: 'R' },
  '/admin/inquiries': { group: 'J', level: 'R' },
  '/admin/tickets': { group: 'J', level: 'R' },
  '/admin/patents': { group: 'J', level: 'R' },
  '/admin/licenses': { group: 'J', level: 'R' },
  '/admin/contracts': { group: 'I', level: 'R' },
  '/admin/handover': { group: 'A', level: 'W' },
  '/admin/search': { group: 'A', level: 'R' },
  '/admin/runbooks': { group: 'A', level: 'R' },

  // Additional existing App.tsx routes
  '/admin/access': { group: 'D!', level: 'W' },
  '/admin/notifications': { group: 'K2', level: 'R' },
  '/admin/zones': { group: 'B', level: 'W' },
  '/admin/v2g': { group: 'C', level: 'R' },
  '/admin/events': { group: 'H', level: 'R' },
  '/admin/policy': { group: 'K2', level: 'W' },
  '/admin/policy/publish': { group: 'CC', level: 'W', stepUp: true },

  // Partner Hub
  '/admin/partner-hub': { group: 'I', level: 'R' },
  '/admin/partner-hub/settlements': { group: 'I', level: 'R' },
  '/admin/partner-hub/reports': { group: 'I', level: 'R' },
};

export function isPublicRoute(path: string): boolean {
  const entry = ROUTE_ACCESS[path];
  return !!entry && 'public' in entry;
}

export function getRouteAccess(path: string): RouteAccessEntry | null {
  const entry = ROUTE_ACCESS[path];
  if (!entry || 'public' in entry) return null;
  return entry;
}

export function findClosestRouteAccess(pathname: string): RouteAccessEntry | null {
  if (ROUTE_ACCESS[pathname] && !('public' in ROUTE_ACCESS[pathname])) {
    return ROUTE_ACCESS[pathname] as RouteAccessEntry;
  }
  const segments = pathname.split('/');
  while (segments.length > 2) {
    segments.pop();
    const parent = segments.join('/');
    if (ROUTE_ACCESS[parent] && !('public' in ROUTE_ACCESS[parent])) {
      return ROUTE_ACCESS[parent] as RouteAccessEntry;
    }
  }
  return null;
}
