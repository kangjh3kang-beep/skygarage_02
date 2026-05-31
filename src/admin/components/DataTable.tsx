import { useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import TableSortLabel from '@mui/material/TableSortLabel';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ClearIcon from '@mui/icons-material/Clear';

type Order = 'asc' | 'desc';

export interface Column<T> {
  id: keyof T & string;
  label: string;
  sortable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface BulkAction<T> {
  label: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'error' | 'warning' | 'success';
  onClick: (selected: T[]) => void;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  searchFields?: (keyof T & string)[];
  searchPlaceholder?: string;
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  onRowClick?: (row: T) => void;
  exportFilename?: string;
  pageSize?: number;
  emptyMessage?: string;
  toolbar?: React.ReactNode;
}

function descendingComparator<T>(a: T, b: T, orderBy: keyof T): number {
  const av = a[orderBy];
  const bv = b[orderBy];
  if (bv == null && av == null) return 0;
  if (bv == null) return -1;
  if (av == null) return 1;
  if (bv < av) return -1;
  if (bv > av) return 1;
  return 0;
}

function getComparator<T>(order: Order, orderBy: keyof T) {
  return order === 'desc'
    ? (a: T, b: T) => descendingComparator(a, b, orderBy)
    : (a: T, b: T) => -descendingComparator(a, b, orderBy);
}

export default function DataTable<T extends { id: string }>({
  columns,
  data,
  searchFields,
  searchPlaceholder = '검색...',
  selectable = false,
  bulkActions = [],
  onRowClick,
  exportFilename,
  pageSize = 25,
  emptyMessage = '데이터가 없습니다.',
  toolbar,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof T & string>(columns[0]?.id || '' as keyof T & string);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

  const filteredData = useMemo(() => {
    if (!search.trim() || !searchFields?.length) return data;
    const lower = search.toLowerCase();
    return data.filter(row =>
      searchFields.some(field => {
        const val = row[field];
        return val != null && String(val).toLowerCase().includes(lower);
      })
    );
  }, [data, search, searchFields]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort(getComparator(order, orderBy));
  }, [filteredData, order, orderBy]);

  const paginatedData = useMemo(() => {
    return sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);

  const handleSort = useCallback((property: keyof T & string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  }, [order, orderBy]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelected(new Set(paginatedData.map(r => r.id)));
    } else {
      setSelected(new Set());
    }
  }, [paginatedData]);

  const handleSelectRow = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedRows = useMemo(() => {
    return data.filter(r => selected.has(r.id));
  }, [data, selected]);

  const handleExportCsv = useCallback(() => {
    const headers = columns.map(c => c.label);
    const rows = sortedData.map(row => columns.map(c => String(row[c.id] ?? '')));
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${exportFilename || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setExportMenuAnchor(null);
  }, [columns, sortedData, exportFilename]);

  const allChecked = paginatedData.length > 0 && paginatedData.every(r => selected.has(r.id));
  const someChecked = paginatedData.some(r => selected.has(r.id)) && !allChecked;

  return (
    <Card>
      {/* Toolbar */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}>
        {searchFields && searchFields.length > 0 && (
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            sx={{ width: 240 }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>,
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}><ClearIcon sx={{ fontSize: 16 }} /></IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
        )}

        {selected.size > 0 && (
          <Chip
            label={`${selected.size}건 선택`}
            size="small"
            color="primary"
            onDelete={() => setSelected(new Set())}
          />
        )}

        {selected.size > 0 && bulkActions.map(action => (
          <Button
            key={action.label}
            size="small"
            variant="outlined"
            color={action.color || 'primary'}
            startIcon={action.icon}
            onClick={() => { action.onClick(selectedRows); setSelected(new Set()); }}
          >
            {action.label}
          </Button>
        ))}

        <Box sx={{ flex: 1 }} />

        {toolbar}

        {exportFilename && (
          <>
            <Tooltip title="내보내기">
              <IconButton size="small" onClick={e => setExportMenuAnchor(e.currentTarget)}>
                <FileDownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={() => setExportMenuAnchor(null)}
            >
              <MenuItem onClick={handleExportCsv}>
                <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
                CSV 내보내기
              </MenuItem>
            </Menu>
          </>
        )}

        <Typography variant="caption" color="text.secondary">
          총 {filteredData.length}건
        </Typography>
      </Box>

      {/* Table */}
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox" sx={{ width: 42 }}>
                  <Checkbox
                    size="small"
                    indeterminate={someChecked}
                    checked={allChecked}
                    onChange={(_e, checked) => handleSelectAll(checked)}
                  />
                </TableCell>
              )}
              {columns.map(col => (
                <TableCell
                  key={col.id}
                  align={col.align || 'left'}
                  sx={{ width: col.width }}
                >
                  {col.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === col.id}
                      direction={orderBy === col.id ? order : 'asc'}
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : (
                    col.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map(row => {
              const isSelected = selected.has(row.id);
              return (
                <TableRow
                  key={row.id}
                  hover
                  selected={isSelected}
                  onClick={() => onRowClick?.(row)}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onClick={e => e.stopPropagation()}
                        onChange={() => handleSelectRow(row.id)}
                      />
                    </TableCell>
                  )}
                  {columns.map(col => (
                    <TableCell key={col.id} align={col.align || 'left'}>
                      {col.render ? col.render(row[col.id], row) : (row[col.id] != null ? String(row[col.id]) : '-')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {paginatedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={filteredData.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_e, p) => setPage(p)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage="페이지당:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}건`}
      />
    </Card>
  );
}
