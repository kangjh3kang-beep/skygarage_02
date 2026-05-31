import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Slide from '@mui/material/Slide';
import CloseIcon from '@mui/icons-material/Close';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import MoreVertIcon from '@mui/icons-material/MoreVert';

export interface BatchAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  confirmMessage?: string;
  destructive?: boolean;
}

interface BatchActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  actions: BatchAction[];
  onAction: (actionId: string) => void;
}

export default function BatchActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  actions,
  onAction,
}: BatchActionBarProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [confirmAction, setConfirmAction] = useState<BatchAction | null>(null);

  if (selectedCount === 0) return null;

  const primaryActions = actions.slice(0, 3);
  const overflowActions = actions.slice(3);

  const handleAction = (action: BatchAction) => {
    setMenuAnchor(null);
    if (action.confirmMessage) {
      setConfirmAction(action);
    } else {
      onAction(action.id);
    }
  };

  return (
    <Slide direction="up" in={selectedCount > 0} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'sticky',
          bottom: 16,
          mx: 'auto',
          maxWidth: 700,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: 1,
          borderColor: 'primary.main',
          boxShadow: 6,
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          zIndex: 1200,
        }}
      >
        <CheckBoxIcon color="primary" sx={{ fontSize: 20 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Chip
            label={`${selectedCount}건 선택`}
            size="small"
            color="primary"
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
          {selectedCount < totalCount && (
            <Typography
              variant="caption"
              color="primary"
              sx={{ cursor: 'pointer', textDecoration: 'underline', '&:hover': { opacity: 0.8 } }}
              onClick={onSelectAll}
            >
              전체 선택 ({totalCount})
            </Typography>
          )}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Box sx={{ display: 'flex', gap: 0.75, flex: 1 }}>
          {primaryActions.map(action => (
            <Button
              key={action.id}
              size="small"
              variant={action.destructive ? 'contained' : 'outlined'}
              color={action.color || 'primary'}
              startIcon={action.icon}
              onClick={() => handleAction(action)}
              sx={{ fontSize: '0.75rem', textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              {action.label}
            </Button>
          ))}

          {overflowActions.length > 0 && (
            <>
              <IconButton size="small" onClick={e => setMenuAnchor(e.currentTarget)}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                slotProps={{ paper: { sx: { minWidth: 180 } } }}
              >
                {overflowActions.map(action => (
                  <MenuItem key={action.id} onClick={() => handleAction(action)}>
                    {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
                    <ListItemText
                      primary={action.label}
                      slotProps={{ primary: { sx: { color: action.destructive ? 'error.main' : 'text.primary' } } }}
                    />
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </Box>

        <IconButton size="small" onClick={onClearSelection} sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>

        {confirmAction && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'background.paper',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              px: 2.5,
              gap: 1.5,
            }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>
              {confirmAction.confirmMessage}
            </Typography>
            <Button
              size="small"
              variant="contained"
              color={confirmAction.destructive ? 'error' : 'primary'}
              onClick={() => { onAction(confirmAction.id); setConfirmAction(null); }}
            >
              확인
            </Button>
            <Button size="small" variant="outlined" onClick={() => setConfirmAction(null)}>
              취소
            </Button>
          </Box>
        )}
      </Box>
    </Slide>
  );
}
