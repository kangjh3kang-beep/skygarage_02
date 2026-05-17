// FILE: src/admin/components/StatCard.tsx
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

interface StatCardProps {
  label: string;
  value: string | number;
  change: number;
  changeLabel: string;
  color: string;
  icon: React.ReactNode;
}

export default function StatCard({ label, value, change, changeLabel, color, icon }: StatCardProps) {
  const isPositive = change >= 0;
  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${color}, ${color}80)`,
        }}
      />
      <CardContent sx={{ p: '20px 24px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {label}
          </Typography>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: `${color}18`,
              border: `1px solid ${color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
            }}
          >
            {icon}
          </Box>
        </Box>
        <Typography
          sx={{
            fontSize: '2.25rem',
            fontWeight: 800,
            color,
            lineHeight: 1,
            mb: 1,
            fontFamily: '"Montserrat", sans-serif',
          }}
        >
          {value}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isPositive ? (
            <TrendingUpIcon sx={{ fontSize: 16, color: '#00e676' }} />
          ) : (
            <TrendingDownIcon sx={{ fontSize: 16, color: '#ff5252' }} />
          )}
          <Typography variant="caption" sx={{ color: isPositive ? '#00e676' : '#ff5252', fontWeight: 700, fontSize: '0.8125rem' }}>
            {isPositive ? '+' : ''}{change}%
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            {changeLabel}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
