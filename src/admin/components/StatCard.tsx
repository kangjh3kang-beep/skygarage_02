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
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' }}>
      <CardContent sx={{ p: '20px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', fontWeight: 500 }}
          >
            {label}
          </Typography>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              background: `${color}12`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              '& .MuiSvgIcon-root': { fontSize: 20 },
            }}
          >
            {icon}
          </Box>
        </Box>
        <Typography
          sx={{
            fontSize: '1.875rem',
            fontWeight: 700,
            color: 'text.primary',
            lineHeight: 1,
            mb: 1.5,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: isPositive ? 'success.main' : 'error.main',
              opacity: 0.12,
              position: 'absolute',
            }}
          />
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            }}
          >
            {isPositive ? (
              <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
            )}
            <Typography variant="caption" sx={{ color: isPositive ? 'success.main' : 'error.main', fontWeight: 600, fontSize: '0.75rem' }}>
              {isPositive ? '+' : ''}{change}%
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
            {changeLabel}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
