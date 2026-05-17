# SkyGarage Admin Page Generator

Generate a fully wired admin CRUD page for the SkyGarage platform, following every established pattern in this codebase exactly.

## How to invoke

`/skygarage-admin-page <PageName> <table_name> [description]`

Example: `/skygarage-admin-page VehicleFleet vehicle_fleet "Fleet vehicle tracking"`

---

## What this skill does

1. Reads the existing codebase patterns from neighboring admin pages
2. Creates `src/admin/pages/<PageName>.tsx` following the standard template
3. Wires the route into `src/App.tsx`
4. Adds the sidebar menu entry in `src/admin/components/Sidebar.tsx`
5. Adds the route title in `src/admin/AdminLayout.tsx`
6. Creates the Supabase migration for the table
7. Runs `npm run build` to verify no TypeScript errors

---

## Codebase Conventions (MUST follow exactly)

### Stack
- React 19 + TypeScript (strict) + Vite 8
- Material-UI v9 (MUI) — import each component individually from `@mui/material/ComponentName`
- Supabase JS v2 client from `../../lib/supabase`
- React Router v7

### File locations
- Admin pages: `src/admin/pages/<PageName>.tsx`
- Route: added to `src/App.tsx` as `lazy(() => import('./admin/pages/<PageName>'))`
- Sidebar entry: `src/admin/components/Sidebar.tsx`
- Layout title: `src/admin/AdminLayout.tsx` `routeTitles` map

### Required imports (every admin page needs these)
```typescript
import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';
```

### State structure (every page)
```typescript
const [loading, setLoading] = useState(true);
const [items, setItems] = useState<DataItem[]>([]);
const [search, setSearch] = useState('');
const [dialogOpen, setDialogOpen] = useState(false);
const [editing, setEditing] = useState<DataItem | null>(null);
const [form, setForm] = useState(EMPTY_FORM);
const [deleteTarget, setDeleteTarget] = useState<DataItem | null>(null);
```

### Data loading pattern (MANDATORY — prevents infinite render loops)
```typescript
const loadData = useCallback(async () => {
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { showToast('로드 실패: ' + error.message, 'error'); return; }
  if (data) setItems(data as DataItem[]);
  setLoading(false);
}, [showToast]); // list all filter deps here

useEffect(() => { loadData(); }, [loadData]);
```

### Real-time subscription pattern (MANDATORY — always include cleanup)
```typescript
useEffect(() => {
  const channel = supabase.channel('page-name-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'table_name' }, () => loadData())
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [loadData]);
```

### CRUD + audit pattern
```typescript
// Save (create or update)
const handleSave = async () => {
  const payload = { /* form fields mapped to DB columns */ };
  if (editing) {
    const { error } = await supabase.from('table').update(payload).eq('id', editing.id);
    if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
    logAction('UPDATE', 'table', editing.id, { key_field: payload.key_field });
    showToast('수정되었습니다.', 'success');
  } else {
    const { error } = await supabase.from('table').insert(payload);
    if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
    logAction('CREATE', 'table', undefined, { key_field: payload.key_field });
    showToast('등록되었습니다.', 'success');
  }
  setDialogOpen(false);
  setEditing(null);
  setForm(EMPTY_FORM);
  loadData();
};

// Delete
const handleDelete = async () => {
  if (!deleteTarget) return;
  const { error } = await supabase.from('table').delete().eq('id', deleteTarget.id);
  if (error) { showToast('삭제 실패: ' + error.message, 'error'); return; }
  logAction('DELETE', 'table', deleteTarget.id, {});
  showToast('삭제 완료', 'success');
  setDeleteTarget(null);
  loadData();
};
```

### Supabase auth rules
- NEVER call `supabase.auth.getUser()` — it makes a network request every time
- Use `supabase.auth.getSession()` instead (reads from local cache)
- For optional single-row queries always use `.maybeSingle()` not `.single()`

### MUI TextField select
- ALWAYS use `<MenuItem>` children, NEVER `<option>` tags
```typescript
<TextField select label="상태" value={filter} onChange={e => setFilter(e.target.value)} size="small">
  <MenuItem value="all">전체</MenuItem>
  <MenuItem value="active">활성</MenuItem>
</TextField>
```

### Dialog pattern
```typescript
// Create/Edit (single dialog, editing state determines mode)
<Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
  <DialogTitle>{editing ? '수정' : '등록'}</DialogTitle>
  <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
    {/* form fields */}
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button onClick={() => setDialogOpen(false)}>취소</Button>
    <Button variant="contained" onClick={handleSave} disabled={!form.required_field}>
      {editing ? '수정' : '등록'}
    </Button>
  </DialogActions>
</Dialog>

// Delete confirmation (separate dialog)
<Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
  <DialogTitle>삭제 확인</DialogTitle>
  <DialogContent>
    <Typography>"{deleteTarget?.name}" 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setDeleteTarget(null)}>취소</Button>
    <Button variant="contained" color="error" onClick={handleDelete}>삭제</Button>
  </DialogActions>
</Dialog>
```

### Loading state
```typescript
if (loading) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
      <CircularProgress />
    </Box>
  );
}
```

### Table structure
```typescript
<Card>
  <TableContainer>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>컬럼명</TableCell>
          {/* ... */}
          <TableCell align="center">작업</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {filtered.length === 0 ? (
          <TableRow>
            <TableCell colSpan={N} align="center" sx={{ py: 4 }}>
              <Typography variant="body2" color="text.secondary">데이터가 없습니다.</Typography>
            </TableCell>
          </TableRow>
        ) : filtered.map(item => (
          <TableRow key={item.id} hover>
            {/* cells */}
            <TableCell align="center">
              <IconButton size="small" onClick={() => handleOpenEdit(item)}>
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton size="small" color="error" onClick={() => setDeleteTarget(item)}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
</Card>
```

### Client-side filter pattern
```typescript
const filtered = items.filter(item =>
  (!search || item.name?.toLowerCase().includes(search.toLowerCase())) &&
  (statusFilter === 'all' || item.status === statusFilter)
);
```

---

## Theme & Design System

### Color palette (from src/theme.ts)
- Primary (cyan): `#00d4ff`
- Gold accent: `#c9a84c`
- Background: `#0a0a0f` (page), `#111827` (cards), `#1a2236` (elevated)
- Success: `#00e676`, Warning: `#ffc107`, Error: `#ff5252`, Info: `#00d4ff`
- Text secondary: `rgba(255,255,255,0.5)`

### Status chip color mapping convention
```typescript
const statusColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  active: 'success',
  inactive: 'default',
  pending: 'warning',
  error: 'error',
};
```

### Typography scale
- Page title: `variant="h1"` (1.5rem, fontWeight 800)
- Section title: `variant="h2"` (1.25rem, fontWeight 700)
- Table header: `fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary'`
- Body: `variant="body2"` (0.8125rem)
- Meta/caption: `variant="caption"` + `color="text.secondary"`

---

## Database Migration Pattern

Every new table needs:
1. `IF NOT EXISTS` guard on CREATE TABLE
2. UUID primary key with `gen_random_uuid()`
3. `created_at timestamptz NOT NULL DEFAULT now()`
4. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
5. Separate policies for SELECT, INSERT, UPDATE (no `FOR ALL`, no `USING (true)`)

```sql
/*
  # Create <table_name> table

  1. New Tables
    - `<table_name>`
      - `id` (uuid, primary key)
      - ... all columns with descriptions
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS
    - Authenticated users can SELECT/INSERT/UPDATE own data
*/

CREATE TABLE IF NOT EXISTS <table_name> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns here
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read <table_name>"
  ON <table_name> FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert <table_name>"
  ON <table_name> FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update <table_name>"
  ON <table_name> FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

Apply using `mcp__supabase__apply_migration` tool — NEVER write to `supabase/migrations/` directly.

---

## Route registration (src/App.tsx)

Find the lazy imports block and add:
```typescript
const <PageName> = lazy(() => import('./admin/pages/<PageName>'));
```

Find the correct route group and add:
```typescript
<Route path="<path>" element={<PageName />} />
```

---

## Sidebar entry (src/admin/components/Sidebar.tsx)

1. Import the icon: `import <IconName> from '@mui/icons-material/<IconName>';`
2. Add to the appropriate `groups` array entry:
```typescript
{ label: '메뉴 이름', path: '/admin/<path>', icon: <IconName /> },
```

Groups in order: 운영, 비즈니스, IP/특허, 지원/정비, 모니터링, 인프라, 프론트엔드, 시스템

---

## AdminLayout route title (src/admin/AdminLayout.tsx)

Add to `routeTitles`:
```typescript
'/admin/<path>': '페이지 제목',
```

---

## Execution steps

When this skill is invoked with `$ARGUMENTS`:

1. Parse arguments: `PageName`, `table_name`, optional description
2. Read `src/admin/pages/ComplexManagement.tsx` to confirm current pattern
3. Read `src/App.tsx` to find lazy import block and route group
4. Read `src/admin/components/Sidebar.tsx` to find correct menu group
5. Create the page file at `src/admin/pages/<PageName>.tsx`
6. Wire the route in `src/App.tsx`
7. Add sidebar entry in `src/admin/components/Sidebar.tsx`
8. Add route title in `src/admin/AdminLayout.tsx`
9. Apply DB migration using `mcp__supabase__apply_migration`
10. Run `npm run build` — fix any TypeScript errors before reporting done

Report what was created and where each change was made.
