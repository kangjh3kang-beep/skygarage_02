import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';

interface PageSkeletonProps {
  variant?: 'dashboard' | 'table' | 'form' | 'detail';
}

export default function PageSkeleton({ variant = 'table' }: PageSkeletonProps) {
  if (variant === 'dashboard') {
    return (
      <Box sx={{ animation: 'fadeIn 0.15s ease-in' }}>
        <Skeleton variant="text" width={200} height={36} sx={{ mb: 2 }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map(i => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <Skeleton variant="rectangular" height={88} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={2}>
          {[1, 2, 3].map(i => (
            <Grid size={{ xs: 12, md: 4 }} key={i}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (variant === 'form') {
    return (
      <Box sx={{ animation: 'fadeIn 0.15s ease-in' }}>
        <Skeleton variant="text" width={200} height={36} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (variant === 'detail') {
    return (
      <Box sx={{ animation: 'fadeIn 0.15s ease-in' }}>
        <Skeleton variant="text" width={240} height={36} sx={{ mb: 2 }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ animation: 'fadeIn 0.15s ease-in' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Skeleton variant="text" width={200} height={36} />
        <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: 1 }} />
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[1, 2].map(i => (
          <Grid size={{ xs: 6, md: 3 }} key={i}>
            <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1 }} />
          </Grid>
        ))}
      </Grid>
      <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1, mb: 0.5 }} />
      {[1, 2, 3, 4, 5].map(i => (
        <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: 0, mb: '1px' }} />
      ))}
    </Box>
  );
}
