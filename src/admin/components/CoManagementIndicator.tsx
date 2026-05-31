import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';
import { useTenant } from '../contexts/TenantContext';

const PREMIUM_GOLD = '#C9A227';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const glowBorder = keyframes`
  0%, 100% { box-shadow: inset 0 0 0 1.5px ${PREMIUM_GOLD}40, 0 0 8px ${PREMIUM_GOLD}20; }
  50% { box-shadow: inset 0 0 0 1.5px ${PREMIUM_GOLD}70, 0 0 12px ${PREMIUM_GOLD}30; }
`;

export default function CoManagementIndicator() {
  const { isImpersonating, scope } = useTenant();

  if (!isImpersonating) return null;

  const targetLabel = scope.building?.name
    || scope.complex?.name
    || scope.region?.name
    || '';

  return (
    <>
      {/* Gold glow border overlay on the entire viewport */}
      <Box
        aria-hidden="true"
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9998,
          animation: `${glowBorder} 3s ease-in-out infinite`,
          borderRadius: 0,
        }}
      />

      {/* Top badge bar */}
      <Box
        role="status"
        aria-live="polite"
        aria-label="HQ 공동 관리 모드 활성화 중"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          py: 0.375,
          bgcolor: `${PREMIUM_GOLD}12`,
          backdropFilter: 'blur(4px)',
          borderBottom: `1px solid ${PREMIUM_GOLD}40`,
          animation: `${pulse} 2.5s ease-in-out infinite`,
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: PREMIUM_GOLD,
            boxShadow: `0 0 6px ${PREMIUM_GOLD}`,
          }}
        />
        <Typography
          sx={{
            fontSize: { xs: '0.625rem', sm: '0.6875rem' },
            fontWeight: 700,
            color: PREMIUM_GOLD,
            letterSpacing: '0.03em',
          }}
        >
          HQ 공동 관리 모드 활성화 중 — 가상 세션
        </Typography>
        {targetLabel && (
          <Typography
            component="span"
            sx={{
              fontSize: { xs: '0.5625rem', sm: '0.625rem' },
              fontWeight: 600,
              color: `${PREMIUM_GOLD}CC`,
              display: { xs: 'none', sm: 'inline' },
            }}
          >
            ({targetLabel})
          </Typography>
        )}
      </Box>
    </>
  );
}
