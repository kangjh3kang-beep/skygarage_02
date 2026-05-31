import { useState, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { getAspectRatioForLayout, getAspectRatioForSlot } from '../../utils/imageCoordinates';
import type { ColumnLayout } from '../../constants/imageLayout';

interface FocalPoint {
  x: number;
  y: number;
}

interface FocalPointPickerProps {
  imageUrl: string;
  value: FocalPoint;
  onChange: (point: FocalPoint) => void;
  scale?: number;
  onScaleChange?: (scale: number) => void;
  layout?: ColumnLayout;
  slot?: string;
}

const MIN_SCALE = 100;
const MAX_SCALE = 300;

export default function FocalPointPicker({
  imageUrl,
  value,
  onChange,
  scale = 100,
  onScaleChange,
  layout,
  slot,
}: FocalPointPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startValue: FocalPoint }>({ x: 0, y: 0, startValue: { x: 50, y: 50 } });

  const aspectRatio = layout
    ? getAspectRatioForLayout(layout)
    : slot
      ? getAspectRatioForSlot(slot)
      : '16/9';

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, startValue: { ...value } };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const pctX = (dx / rect.width) * 100;
    const pctY = (dy / rect.height) * 100;
    onChange({
      x: clamp(dragStartRef.current.startValue.x - pctX),
      y: clamp(dragStartRef.current.startValue.y - pctY),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const resetCenter = () => {
    onChange({ x: 50, y: 50 });
    onScaleChange?.(100);
  };

  const handleScaleChange = useCallback((_: Event, val: number | number[]) => {
    onScaleChange?.(val as number);
  }, [onScaleChange]);

  const imgScale = scale / 100;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          프론트엔드 미리보기 (드래그로 조정)
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
            {value.x}%, {value.y}%
          </Typography>
          <Tooltip title="중앙으로 리셋">
            <IconButton size="small" onClick={resetCenter} sx={{ p: 0.25 }}>
              <CenterFocusStrongIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Preview - same aspect ratio and CSS as frontend */}
      <Box
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio,
          maxHeight: 300,
          borderRadius: 1,
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'grab',
          border: 2,
          borderColor: dragging ? 'primary.main' : 'divider',
          transition: (t) => t.transitions.create('border-color', { duration: t.transitions.duration.shorter }),
          userSelect: 'none',
          touchAction: 'none',
          bgcolor: 'common.black',
        }}
      >
        <Box
          component="img"
          src={imageUrl}
          alt=""
          draggable={false}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: `${value.x}% ${value.y}%`,
            transform: imgScale > 1 ? `scale(${imgScale})` : undefined,
            transformOrigin: `${value.x}% ${value.y}%`,
            pointerEvents: 'none',
          }}
        />

        {/* Crosshair at center */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            opacity: dragging ? 1 : 0.6,
            transition: 'opacity 0.2s',
          }}
        >
          <Box sx={{ position: 'absolute', top: '50%', left: -12, width: 24, height: '1.5px', bgcolor: 'common.white', transform: 'translateY(-50%)', boxShadow: '0 0 4px rgba(0,0,0,0.9)' }} />
          <Box sx={{ position: 'absolute', left: '50%', top: -12, width: '1.5px', height: 24, bgcolor: 'common.white', transform: 'translateX(-50%)', boxShadow: '0 0 4px rgba(0,0,0,0.9)' }} />
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', border: '2px solid', borderColor: 'common.white', boxShadow: '0 0 6px rgba(0,0,0,0.7)' }} />
        </Box>

        {/* Direction arrows when dragging */}
        {dragging && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: 1,
              pointerEvents: 'none',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
            }}
          />
        )}

        {/* Label */}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            bottom: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'common.white',
            bgcolor: 'rgba(0,0,0,0.75)',
            px: 1,
            py: 0.25,
            borderRadius: 0.5,
            fontSize: '0.6rem',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            opacity: dragging ? 0 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          이 화면이 프론트엔드에 표시됩니다
        </Typography>
      </Box>

      {/* Zoom slider */}
      {onScaleChange && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Tooltip title="축소">
            <ZoomOutIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Tooltip>
          <Slider
            size="small"
            value={scale}
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={5}
            onChange={handleScaleChange}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}%`}
            aria-label="확대/축소"
            sx={{
              flex: 1,
              '& .MuiSlider-thumb': { width: 14, height: 14 },
              '& .MuiSlider-track': { height: 3 },
              '& .MuiSlider-rail': { height: 3 },
            }}
          />
          <Tooltip title="확대">
            <ZoomInIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Tooltip>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 32, textAlign: 'right' }}>
            {scale}%
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export type { FocalPoint };
