import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import YouTubeIcon from '@mui/icons-material/YouTube';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import TwitterIcon from '@mui/icons-material/Twitter';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

const footerLinks = [
  {
    title: '시스템',
    links: [
      { label: '스카이게러지 소개', sectionId: 'solution' },
      { label: 'ATR 자율이송로봇', sectionId: 'technology' },
      { label: '세대직입 시스템', sectionId: 'benefits' },
      { label: '프로세스 안내', sectionId: 'process' },
    ],
  },
  {
    title: '적용 분야',
    links: [
      { label: '공동주택', sectionId: 'market' },
      { label: '오피스텔', sectionId: 'market' },
      { label: '주상복합', sectionId: 'market' },
      { label: '지식산업센터', sectionId: 'market' },
    ],
  },
  {
    title: '회사 정보',
    links: [
      { label: '주식회사 제이에이치홀딩스', sectionId: 'trust' },
      { label: '특허 현황', sectionId: 'trust' },
      { label: '기술 파트너', sectionId: 'trust' },
      { label: '도입 문의', sectionId: 'contact' },
      { label: '특허 기술', sectionId: '__route__/patent' },
      { label: '브랜드 가이드', sectionId: '__route__/brand-guide' },
    ],
  },
];

export default function Footer() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const footerBg = isDark
    ? `linear-gradient(180deg, ${COLORS.BG_SECONDARY} 0%, #050508 100%)`
    : `linear-gradient(180deg, #ede8da 0%, #e0d9c8 100%)`;

  const footerBorderTop = isDark
    ? '1px solid rgba(201,168,76,0.1)'
    : '1px solid rgba(158,127,48,0.15)';

  const socialBtnColor = isDark ? COLORS.SILVER : '#6b7280';
  const socialBtnBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)';

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <Box
      component="footer"
      sx={{
        background: footerBg,
        borderTop: footerBorderTop,
        pt: { xs: 6, md: 8 },
        pb: 4,
        position: 'relative',
      }}
    >
      <Container maxWidth="lg">
        {/* Top section */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '2fr repeat(3, 1fr)' },
            gap: 4,
            mb: 6,
          }}
        >
          {/* Brand */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                component="img"
                src="/logo-palatria.webp"
                alt="PALATRIA"
                sx={{
                  width: 52,
                  height: 52,
                  objectFit: 'contain',
                  filter: isDark ? 'drop-shadow(0 0 10px rgba(201,168,76,0.5))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
                }}
              />
              <Box>
                <Typography
                  sx={{
                    fontFamily: '"Montserrat", sans-serif',
                    fontWeight: 900,
                    fontSize: '1rem',
                    letterSpacing: '0.1em',
                    background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: 1.1,
                  }}
                >
                  SKYGARAGE
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: COLORS.SILVER, letterSpacing: '0.05em' }}>
                  스카이게러지 팔라트리아
                </Typography>
              </Box>
            </Box>

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5, lineHeight: 1.7, fontSize: '0.82rem', maxWidth: 260 }}>
              ATR 자율이송주차로봇 × 세대직입 주차시스템.
              주거 환경의 혁신을 통해 모든 입주민의 삶을 바꿉니다.
            </Typography>

            {/* SNS */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {[
                { icon: <YouTubeIcon sx={{ fontSize: 18 }} />, label: 'YouTube', href: 'https://youtube.com' },
                { icon: <LinkedInIcon sx={{ fontSize: 18 }} />, label: 'LinkedIn', href: 'https://linkedin.com' },
                { icon: <TwitterIcon sx={{ fontSize: 18 }} />, label: 'Twitter', href: 'https://twitter.com' },
                { icon: <InstagramIcon sx={{ fontSize: 18 }} />, label: 'Instagram', href: 'https://instagram.com' },
                { icon: <FacebookIcon sx={{ fontSize: 18 }} />, label: 'Facebook', href: 'https://facebook.com' },
              ].map((social) => (
                <IconButton
                  key={social.label}
                  aria-label={social.label}
                  component="a"
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  sx={{
                    color: socialBtnColor,
                    border: socialBtnBorder,
                    borderRadius: 1.5,
                    width: 32,
                    height: 32,
                    '&:hover': {
                      color: goldColor,
                      borderColor: isDark ? 'rgba(201,168,76,0.4)' : 'rgba(158,127,48,0.4)',
                      background: isDark ? 'rgba(201,168,76,0.08)' : 'rgba(158,127,48,0.08)',
                    },
                  }}
                >
                  {social.icon}
                </IconButton>
              ))}
            </Box>
          </Box>

          {/* Links */}
          {footerLinks.map((group) => (
            <Box key={group.title}>
              <Typography
                variant="overline"
                sx={{
                  color: goldColor,
                  fontSize: '0.65rem',
                  letterSpacing: '0.15em',
                  fontWeight: 700,
                  mb: 2,
                  display: 'block',
                }}
              >
                {group.title}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {group.links.map((link) => (
                  <Typography
                    key={link.label}
                    variant="caption"
                    onClick={() => {
                      if (link.sectionId.startsWith('__route__')) {
                        navigate(link.sectionId.replace('__route__', ''));
                      } else {
                        document.getElementById(link.sectionId)?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease',
                      '&:hover': { color: isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD_DARK },
                    }}
                  >
                    {link.label}
                  </Typography>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        <Divider />

        {/* Bottom */}
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem', display: 'block' }}>
              © 2026 주식회사 제이에이치홀딩스. All rights reserved.
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', mt: 0.25, display: 'block' }}>
              스카이게러지(SkyGarage) ATR 자율이송주차로봇 및 세대직입 주차시스템은 특허 출원된 기술입니다.
              무단 복제·도용 시 법적 제재를 받을 수 있습니다.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { label: '개인정보처리방침', sectionId: 'contact' },
              { label: '이용약관', sectionId: 'contact' },
              { label: '특허 고지', sectionId: 'trust' },
            ].map((item) => (
              <Typography
                key={item.label}
                variant="caption"
                onClick={() => document.getElementById(item.sectionId)?.scrollIntoView({ behavior: 'smooth' })}
                sx={{
                  color: 'text.disabled',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  '&:hover': { color: COLORS.SILVER },
                  transition: 'color 0.2s ease',
                }}
              >
                {item.label}
              </Typography>
            ))}
          </Box>
        </Box>
      </Container>

      {/* Back to top button */}
      <IconButton
        onClick={scrollToTop}
        aria-label="Back to top"
        sx={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 44,
          height: 44,
          background: `linear-gradient(135deg, ${COLORS.GOLD_DARK}, ${COLORS.GOLD})`,
          color: '#0a0a0f',
          boxShadow: `0 4px 16px rgba(201,168,76,0.35)`,
          '&:hover': {
            background: `linear-gradient(135deg, ${COLORS.GOLD}, ${COLORS.GOLD_LIGHT})`,
            boxShadow: `0 6px 24px rgba(201,168,76,0.55)`,
            transform: 'translateY(-3px)',
          },
          transition: 'all 0.3s ease',
        }}
      >
        <KeyboardArrowUpIcon />
      </IconButton>
    </Box>
  );
}
