# SkyGarage Platform Architecture Reference

Deep technical reference for the SkyGarage 5-Tier Admin Platform. Use this skill to understand the codebase before making changes, or to answer "how does X work?" questions about this project.

---

## Project Overview

SkyGarage is an automated vertical parking management SaaS deployed globally (KR, SG, AE, US, EU). The admin platform manages the full lifecycle: hardware (ATR robots, elevators), residents, billing, CRM, AI agents, and infrastructure — across a 5-tier operational hierarchy.

**Tech Stack:**
- Frontend: React 19 + TypeScript 6 + Vite 8 + Material-UI v9
- Backend: Supabase (PostgreSQL 15, Auth, Storage, Edge Functions, Realtime)
- Edge Functions: Deno + TypeScript
- AI: Anthropic Claude (via Edge Function proxy)
- Deployment: Static SPA + Supabase cloud

---

## 5-Tier Architecture

```
T0  Aegis   — Global NOC      Security, compliance, cross-region visibility
T1  Aurora  — Region Hub      Resource optimization, region-level reporting
T2  Atlas   — Zone Console    Operations coordination within a zone
T3  Argus   — Complex Edge    Real-time per-complex monitoring
T4  Athena  — Project Tracker Strategic planning, installation projects
```

Each tier maps to:
- A sidebar menu group
- An AI agent in `ai_agent_configs` table
- A set of admin pages scoped to that tier's responsibilities
- A color: T0=#ff5252 T1=#ff9800 T2=#00d4ff T3=#00e676 T4=#c9a84c

---

## Directory Structure

```
src/
├── admin/
│   ├── components/
│   │   ├── FocalPointPicker.tsx   — Image focal point selection UI
│   │   ├── Sidebar.tsx            — Left navigation (260px, collapsible groups)
│   │   ├── StatCard.tsx           — KPI metric card component
│   ├── contexts/
│   │   ├── AuthContext.tsx        — Auth state + RBAC (user, role, signIn, signOut)
│   │   ├── TenantContext.tsx      — Selected complex state
│   │   ├── ToastContext.tsx       — showToast(message, severity) notifications
│   ├── pages/                     — 50+ admin pages, all lazy-loaded
│   └── AdminLayout.tsx            — AppBar + Sidebar shell for all /admin/* routes
├── components/                    — Public landing page components
├── hooks/
│   ├── useAdminAuth.ts            — Simple auth check (isAdmin boolean)
│   ├── useAuditLog.ts             — logAction(action, table, id, details)
│   ├── useDocumentTitle.ts        — Sets <title> per page
│   ├── useIntersection.ts         — IntersectionObserver for scroll animations
│   ├── usePageTracking.ts         — Page view analytics
│   ├── useSessionTimeout.ts       — Idle session auto-logout
│   └── useSiteImages.ts           — Fetch site images from DB
├── lib/
│   ├── supabase.ts                — Singleton Supabase client
│   └── types.ts                   — Shared TypeScript types (Inquiry, etc.)
├── pages/
│   └── LandingPage.tsx            — Public landing page wrapper
└── App.tsx                        — Root router (lazy routes + protected routes)
```

---

## Authentication & Authorization

### Auth flow
1. `AuthProvider` mounts → calls `supabase.auth.getSession()` (cache)
2. Session found → `fetchRole(user.id)` queries `user_roles` table
3. Sets `user`, `role`, `loading=false` → renders protected routes
4. `onAuthStateChange` subscription handles token refresh / logout

### Role hierarchy
```
super_admin  — unrestricted, bypasses most RLS policies
admin        — restricted to assigned complexes
manager      — department-level access
operator     — basic operational read/write
viewer       — read-only
```

### RBAC tables
- `user_roles` — `{user_id, role, display_name}` — one row per user
- `user_complex_assignments` — maps users to specific complexes with optional `role_override` + fine-grained `permissions` JSONB
- `feature_flags` — `{complex_id, feature_key, enabled, config}` for gradual rollout

### Key auth rules
- NEVER use `supabase.auth.getUser()` — always `supabase.auth.getSession()` (avoids network call)
- The first user to create a `user_roles` entry is auto-promoted to `super_admin` via DB trigger `auto_assign_first_admin()`
- Admin routes: `/admin/*` — wrapped in `ProtectedRoutes` component that checks `useAuth().user`

---

## Context Providers (wrap order in App.tsx)

```
ThemeProvider (admin dark theme)
  AuthProvider
    TenantProvider         ← fetches all complexes on mount
      ToastProvider        ← Snackbar notification system
        AdminLayout
          <page content>
```

### ToastContext usage
```typescript
const { showToast } = useToast();
showToast('저장되었습니다.', 'success');   // green
showToast('오류: ' + err.message, 'error'); // red
showToast('경고 메시지', 'warning');         // amber
showToast('정보 메시지', 'info');            // cyan
```

### TenantContext usage
```typescript
const { complexes, selectedComplex } = useTenant();
// selectedComplex is null if no complex selected (global view)
// Use for scoping DB queries: if (selectedComplex) query.eq('complex_id', selectedComplex.id)
```

---

## Database Schema (30+ tables)

### Core operational tables
| Table | Purpose |
|-------|---------|
| `complexes` | Apartment complexes with SkyGarage installed |
| `atr_units` | ATR robot fleet (status, battery, floor, cycles) |
| `elevators` | Vehicle elevator inventory |
| `parking_sessions` | Active + historical parking records |
| `resident_accounts` | Residents with vehicle registrations |
| `safety_events` | Safety chain events, ALLOW gate log |
| `system_metrics` | Periodic health metrics |
| `energy_metrics` | EV charging, solar, V2G data |
| `maintenance_logs` | Scheduled + completed maintenance |
| `access_logs` | Gate access log |

### Business tables
| Table | Purpose |
|-------|---------|
| `contracts` | Service contracts |
| `partners` | Partner organizations |
| `billing_invoices` | Monthly invoices |
| `crm_leads` | Sales pipeline |
| `inquiries` | Customer inquiries with notes + history |
| `revenue_reports` | Financial summaries |

### Tier architecture tables
| Table | Purpose |
|-------|---------|
| `regions` | T1 regions (KR, SG, AE, US, EU) |
| `zones` | T2 zones within regions |
| `ev_schedules` | V2G charging schedules |
| `esg_certifications` | ESG compliance records |
| `projects` | T4 installation/upgrade projects |
| `project_milestones` | Project phases and completion |

### AI & workflow tables
| Table | Purpose |
|-------|---------|
| `ai_agent_configs` | Agent definitions (tier, model, system_prompt, tools) |
| `ai_conversations` | Chat history — messages stored as `jsonb[]` array |
| `workflow_definitions` | Automation workflow templates |
| `workflow_executions` | Running/completed workflow instances |
| `event_log` | Central event bus (source_tier, source_id, payload) |
| `observability_metrics` | System observability data |

### Platform tables
| Table | Purpose |
|-------|---------|
| `user_roles` | User → role mapping |
| `user_complex_assignments` | User → complex mapping + permissions |
| `feature_flags` | Per-complex feature toggles |
| `security_audit_logs` | Audit trail (user_id, action, table_name, record_id, details) |
| `admin_settings` | Key-value store for platform config |
| `admin_notifications` | In-app notifications |
| `support_tickets` | Support ticket system |
| `team_members` | Staff directory |
| `patents` | Patent portfolio |
| `licenses` | Technology licenses |
| `section_media` | CMS media for landing page sections |
| `page_views` | Analytics page view tracking |

### CRITICAL: ai_conversations message format
Messages are stored as a JSONB array on the conversation row — NOT as separate rows:
```typescript
// Correct: conversation.messages is an array
interface Message { role: 'user' | 'assistant'; content: string; timestamp: string; }
interface Conversation {
  id: string;
  agent_id: string;
  user_id: string;
  title: string;
  messages: Message[];  // ← JSONB array, entire history on one row
  status: 'active' | 'archived';
}
```

---

## Edge Functions

### ai-agent (`supabase/functions/ai-agent/index.ts`)

**Endpoint:** `POST /functions/v1/ai-agent`

**Auth:** Bearer token in Authorization header (user's Supabase access token)

**Request body:**
```json
{ "agent_id": "uuid", "message": "user message", "conversation_id": "uuid|null" }
```

**Response:**
```json
{ "response": "agent reply", "conversation_id": "uuid" }
```

**Flow:**
1. Validate Bearer token → get user
2. Fetch `ai_agent_configs` row by `agent_id`
3. Call Claude API if `ANTHROPIC_API_KEY` set, else use simulated fallback
4. Upsert `ai_conversations` (create new or append to existing messages array)
5. Log to `event_log`
6. Return response + conversation_id

**Calling from frontend:**
```typescript
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ agent_id, message, conversation_id }),
});
```

### workflow-engine (`supabase/functions/workflow-engine/index.ts`)

**Endpoint:** `POST /functions/v1/workflow-engine`

Executes workflow definitions from `workflow_definitions` table.

---

## Code Splitting & Bundle

All admin routes are lazy-loaded via `React.lazy()` + `Suspense`:
```typescript
const Dashboard = lazy(() => import('./admin/pages/Dashboard'));
// ...50+ lazy imports
```

Bundle output (production):
- `index-*.js` — ~705KB (MUI + React vendor, unavoidable)
- Each page: 4–25KB (lazy chunks loaded on demand)
- Total initial load: ~705KB, additional pages load asynchronously

---

## Design System (src/theme.ts)

### Admin theme (dark)
```typescript
// Backgrounds
bg_primary:   '#0a0a0f'   // page background
bg_secondary: '#111827'   // card surfaces
bg_elevated:  '#1a2236'   // modals, elevated cards

// Brand colors
primary:  '#00d4ff'        // cyan (operational)
gold:     '#c9a84c'        // premium/strategic
silver:   '#a8b2c1'        // neutral

// Semantic
success: '#00e676'
warning: '#ffc107'
error:   '#ff5252'
info:    '#00d4ff'
```

### Typography
- h1: 1.5rem / fontWeight 800 (page titles)
- h2: 1.25rem / fontWeight 700 (section headers)
- body2: 0.8125rem (default table/list content)
- caption: 0.75rem + color="text.secondary" (metadata)
- Table headers: fontSize '0.75rem', fontWeight 700, muted color

### MUI overrides applied globally
- `Button.textTransform: 'none'` — preserve casing
- `Button.fontWeight: 700`
- `Button.borderRadius: 8`
- `Table.header fontSize: 0.75rem`
- `Card.border: '1px solid rgba(255,255,255,0.06)'`

---

## Routing Map

All routes in `src/App.tsx`:

```
/                    → LandingPage (public)
/patent              → PatentPage (public)
/brand               → BrandGuidePage (public)
/valet               → SkyGarageValet (public)
/admin               → Dashboard
/admin/complexes     → ComplexManagement
/admin/residents     → ResidentManagement
/admin/parking       → ParkingOperations
/admin/atr           → AtrManagement
/admin/elevators     → ElevatorManagement
/admin/energy        → EnergyDashboard
/admin/contracts     → ContractManagement
/admin/partners      → PartnerManagement
/admin/billing       → BillingInvoices
/admin/revenue       → RevenueBilling
/admin/crm           → CrmDashboard
/admin/inquiries     → InquiryList (detail: /admin/inquiries/:id)
/admin/maintenance   → MaintenanceManagement
/admin/tickets       → SupportTickets
/admin/alerts        → AlertCenter
/admin/notifications → Notifications
/admin/noc           → GlobalNOC
/admin/analytics     → Analytics
/admin/observability → ObservabilityDashboard
/admin/esg           → EsgReporting
/admin/security      → SecurityAudit
/admin/access        → AccessControl
/admin/images        → ImageManager
/admin/media         → SectionMediaManager
/admin/users         → UserManagement
/admin/team          → TeamManagement
/admin/ai            → AIAgentChat
/admin/settings      → Settings
/admin/operations    → OperationsDashboard
/admin/system        → SystemOverview
/admin/safety        → SafetyPolicy
/admin/projects      → ProjectTracker
/admin/regions       → RegionHub
/admin/zones         → ZoneConsole
/admin/workflows     → WorkflowManager
/admin/v2g           → V2GEnergyTrading
/admin/events        → EventLog
/admin/patents       → PatentManagement
/admin/licenses      → LicenseManagement
```

---

## RLS Security Pattern

Every table has RLS enabled. Standard policies for operational tables:

```sql
-- SELECT: any authenticated user
CREATE POLICY "Authenticated users can read <table>"
  ON <table> FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- INSERT: any authenticated user
CREATE POLICY "Authenticated users can insert <table>"
  ON <table> FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: any authenticated user
CREATE POLICY "Authenticated users can update <table>"
  ON <table> FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

For user-owned data (conversations, roles):
```sql
USING (auth.uid() = user_id)
```

For super_admin bypass:
```sql
USING (
  EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
```

**NEVER use `USING (true)` — it defeats RLS.**

---

## Audit Logging

Every CRUD operation must be logged via `useAuditLog`:
```typescript
const { logAction } = useAuditLog();

// On create
logAction('CREATE', 'table_name', undefined, { name: item.name });

// On update
logAction('UPDATE', 'table_name', item.id, { name: item.name });

// On delete
logAction('DELETE', 'table_name', item.id, { name: item.name });
```

This inserts to `security_audit_logs` with `{user_id, action, table_name, record_id, details, created_at}`.

---

## Key Patterns Quick Reference

### Parallel data fetching
```typescript
const [r1, r2, r3] = await Promise.all([
  supabase.from('t1').select('*'),
  supabase.from('t2').select('*', { count: 'exact', head: true }),
  supabase.from('t3').select('id, name'),
]);
```

### Count-only query
```typescript
const { count } = await supabase
  .from('table')
  .select('id', { count: 'exact', head: true });
```

### Optional single row
```typescript
const { data } = await supabase.from('t').select('*').eq('id', id).maybeSingle();
// data is null if not found, no error thrown
```

### Real-time subscription
```typescript
useEffect(() => {
  const ch = supabase.channel('unique-channel-id')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tablename' }, () => reload())
    .subscribe();
  return () => supabase.removeChannel(ch);
}, [reload]);
```

### Korean date formatting
```typescript
new Date(item.created_at).toLocaleDateString('ko-KR')
// → "2026. 5. 17."
```

---

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| `<option>` inside MUI TextField select | Use `<MenuItem>` |
| `supabase.auth.getUser()` in hooks/effects | Use `supabase.auth.getSession()` |
| `single()` when row might not exist | Use `maybeSingle()` |
| Missing `return () => supabase.removeChannel(ch)` | Always clean up subscriptions |
| `useCallback` with missing deps causing stale closure | List all filter/context deps |
| `Math.random()` in chart fallback data | Use deterministic defaults |
| CSV export filtering on wrong field | Ensure filter uses correct FK column |
| Missing `complex_id` in interface but used in filter | Add to interface definition |
