import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { keyframes } from '@mui/system';
import { COLORS } from '../theme';

const pulseGold = keyframes`
  0%, 100% { opacity: 1; filter: drop-shadow(0 0 8px #c9a84c); }
  50% { opacity: 0.7; filter: drop-shadow(0 0 20px #e8c96a); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; pointer-events: none; }
`;

const rotateBorder = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

interface Props {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setLeaving(true);
            setTimeout(onComplete, 600);
          }, 300);
          return 100;
        }
        return prev + Math.random() * 12 + 4;
      });
    }, 80);
    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(ellipse at center, #0f1824 0%, #0a0a0f 70%)`,
        animation: leaving ? `${fadeOut} 0.6s ease forwards` : 'none',
      }}
    >
      {/* Particle lines */}
      {[...Array(6)].map((_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: '1px',
            height: '30%',
            background: `linear-gradient(to bottom, transparent, rgba(201,168,76,${0.05 + i * 0.03}), transparent)`,
            left: `${10 + i * 16}%`,
            top: '0',
            transform: `rotate(${-5 + i * 2}deg)`,
          }}
        />
      ))}

      {/* Logo container */}
      <Box
        sx={{
          position: 'relative',
          width: 120,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 4,
          animation: `${fadeIn} 0.6s ease`,
        }}
      >
        {/* Rotating border */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid transparent`,
            borderTop: `2px solid ${COLORS.GOLD}`,
            borderRight: `2px solid rgba(201,168,76,0.3)`,
            animation: `${rotateBorder} 1.5s linear infinite`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 8,
            borderRadius: '50%',
            border: `1px solid rgba(201,168,76,0.15)`,
          }}
        />
        {/* Logo SVG */}
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: `${pulseGold} 2s ease-in-out infinite`,
          }}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path
              d="M24 4 L40 14 L40 34 L24 44 L8 34 L8 14 Z"
              stroke={COLORS.GOLD}
              strokeWidth="1.5"
              fill="none"
              opacity="0.4"
            />
            <path
              d="M24 8 L36 16 L36 32 L24 40 L12 32 L12 16 Z"
              stroke={COLORS.GOLD_LIGHT}
              strokeWidth="1"
              fill="rgba(201,168,76,0.08)"
            />
            <rect x="16" y="22" width="16" height="8" rx="2" fill={COLORS.GOLD} opacity="0.9" />
            <circle cx="20" cy="32" r="2.5" fill={COLORS.GOLD_DARK} />
            <circle cx="28" cy="32" r="2.5" fill={COLORS.GOLD_DARK} />
            <path d="M14 22 L20 16 L28 16 L34 22" stroke={COLORS.GOLD_LIGHT} strokeWidth="1.5" fill="none" />
          </svg>
        </Box>
      </Box>

      {/* Brand name */}
      <Box sx={{ textAlign: 'center', mb: 5, animation: `${fadeIn} 0.6s 0.2s ease both` }}>
        <Typography
          variant="h4"
          sx={{
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: 900,
            letterSpacing: '0.15em',
            background: `linear-gradient(135deg, ${COLORS.GOLD_DARK} 0%, ${COLORS.GOLD} 40%, ${COLORS.GOLD_LIGHT} 60%, ${COLORS.GOLD} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1,
            fontSize: { xs: '1.4rem', sm: '1.8rem' },
          }}
        >
          PALATRIA SKYGARAGE
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.08em',
            fontSize: { xs: '0.72rem', sm: '0.8rem' },
            lineHeight: 1.8,
          }}
        >
          AI주거혁명 팔라트리아 스카이게러지
        </Typography>
      </Box>

      {/* Progress bar */}
      <Box
        sx={{
          width: 240,
          animation: `${fadeIn} 0.6s 0.4s ease both`,
        }}
      >
        <LinearProgress
          variant="determinate"
          value={Math.min(progress, 100)}
          sx={{
            height: 3,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.05)',
            '& .MuiLinearProgress-bar': {
              background: `linear-gradient(90deg, ${COLORS.GOLD_DARK}, ${COLORS.GOLD}, ${COLORS.GOLD_LIGHT})`,
              borderRadius: 2,
              boxShadow: `0 0 10px rgba(201,168,76,0.5)`,
            },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 1.5,
            color: COLORS.SILVER,
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
          }}
        >
          {Math.min(Math.round(progress), 100)}%
        </Typography>
      </Box>

      {/* Company name */}
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          bottom: 32,
          color: COLORS.SILVER,
          opacity: 0.5,
          letterSpacing: '0.08em',
          fontSize: '0.7rem',
          animation: `${fadeIn} 0.6s 0.6s ease both`,
        }}
      >
        주식회사 제이에이치홀딩스
      </Typography>
    </Box>
  );
}
