import { useMemo } from 'react';
import Box from '@mui/material/Box';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
}

export default function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#4caf50',
  fillOpacity = 0.15,
  strokeWidth = 1.5,
}: SparklineProps) {
  const { linePath, fillPath } = useMemo(() => {
    if (data.length < 2) return { linePath: '', fillPath: '' };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padY = 2;
    const effectiveHeight = height - padY * 2;

    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = padY + effectiveHeight - ((val - min) / range) * effectiveHeight;
      return { x, y };
    });

    const linePoints = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const fill = `${linePoints} L ${width} ${height} L 0 ${height} Z`;

    return { linePath: linePoints, fillPath: fill };
  }, [data, width, height]);

  if (data.length < 2) return null;

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={fillPath} fill={color} opacity={fillOpacity} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Box>
  );
}
