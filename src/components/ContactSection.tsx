import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import { keyframes } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { COLORS } from '../theme';
import { useIntersection } from '../hooks/useIntersection';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import FaxIcon from '@mui/icons-material/Fax';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleIcon from '@mui/icons-material/People';

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

interface FormData {
  company: string;
  name: string;
  phone: string;
  email: string;
  projectType: string;
  message: string;
}

interface FormErrors {
  company?: string;
  name?: string;
  phone?: string;
  email?: string;
  projectType?: string;
  message?: string;
}

const targetAudience = [
  {
    title: '시공사·시행사',
    subtitle: '시공사 ·시행사',
  },
  {
    title: '입주자대표회의·관리소',
    subtitle: '입주자대표회의 ·관리소',
  },
  {
    title: '정부·지자체',
    subtitle: '정부 ·지자체',
  },
];

export default function ContactSection() {
  const { ref, visible } = useIntersection();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const goldColor = isDark ? COLORS.GOLD : COLORS.GOLD_DARK;
  const goldLight = isDark ? COLORS.GOLD_LIGHT : COLORS.GOLD;

  const [formData, setFormData] = useState<FormData>({
    company: '',
    name: '',
    phone: '',
    email: '',
    projectType: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.company.trim()) newErrors.company = '회사명을 입력해주세요';
    if (!formData.name.trim()) newErrors.name = '담당자명을 입력해주세요';
    if (!formData.phone.trim()) newErrors.phone = '연락처를 입력해주세요';
    else if (!/^[0-9\-+() ]{7,15}$/.test(formData.phone.trim())) newErrors.phone = '올바른 연락처를 입력해주세요';
    if (!formData.email.trim()) newErrors.email = '이메일을 입력해주세요';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) newErrors.email = '올바른 이메일 주소를 입력해주세요';
    if (!formData.projectType) newErrors.projectType = '프로젝트 유형을 선택해주세요';
    if (!formData.message.trim()) newErrors.message = '문의 내용을 입력해주세요';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(false);
    const { error } = await supabase.from('inquiries').insert({
      company: formData.company.trim(),
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      project_type: formData.projectType,
      message: formData.message.trim(),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(true);
    } else {
      setSubmitted(true);
    }
  };

  const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const sectionBg = isDark
    ? `linear-gradient(180deg, #0a0a0f 0%, ${COLORS.BG_SECONDARY} 100%)`
    : `linear-gradient(180deg, #f8f6f0 0%, #ede8da 100%)`;

  const contactDetailsBg = isDark ? COLORS.BG_ELEVATED : '#ffffff';
  const contactDetailsBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)';

  const formBg = isDark ? COLORS.BG_ELEVATED : '#ffffff';
  const formBorder = isDark ? '1px solid rgba(201,168,76,0.15)' : '1px solid rgba(158,127,48,0.2)';

  if (submitted) {
    return (
      <Box
        id="contact"
        component="section"
        sx={{
          py: { xs: 6, md: 8 },
          background: isDark ? '#0a0a0f' : '#f8f6f0',
        }}
      >
        <Container maxWidth="md">
          <Box
            sx={{
              textAlign: 'center',
              p: { xs: 4, md: 8 },
              background: isDark
                ? `linear-gradient(135deg, rgba(201,168,76,0.06), ${COLORS.BG_ELEVATED})`
                : `linear-gradient(135deg, rgba(201,168,76,0.08), #ffffff)`,
              border: isDark ? `1px solid rgba(201,168,76,0.3)` : `1px solid rgba(158,127,48,0.3)`,
              borderRadius: 3,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 64, color: '#10b981', mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
              문의가 접수되었습니다!
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              영업일 기준 1~2일 내에 담당자가 연락드리겠습니다.
              <br />
              스카이게러지에 관심 가져주셔서 감사합니다.
            </Typography>
            <Button variant="outlined" onClick={() => setSubmitted(false)}>
              새 문의하기
            </Button>
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      id="contact"
      component="section"
      sx={{
        py: { xs: 6, md: 8 },
        background: sectionBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: '50%',
          background: `radial-gradient(ellipse, rgba(201,168,76,0.04) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" ref={ref}>
        {/* Target audience cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2,
            mb: { xs: 4, md: 5 },
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(20px)',
            transition: 'all 0.6s ease',
          }}
        >
          {targetAudience.map((item) => (
            <Box
              key={item.title}
              sx={{
                textAlign: 'center',
                p: { xs: 2.5, md: 3 },
                background: isDark ? COLORS.BG_ELEVATED : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                borderRadius: 3,
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: isDark ? 'rgba(201,168,76,0.3)' : 'rgba(158,127,48,0.3)',
                  transform: 'translateY(-4px)',
                  boxShadow: isDark
                    ? '0 8px 32px rgba(0,0,0,0.3)'
                    : '0 8px 32px rgba(0,0,0,0.08)',
                },
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '0.95rem', md: '1.05rem' },
                  mb: 0.5,
                }}
              >
                {item.title}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                }}
              >
                {item.subtitle}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* CTA Button */}
        <Box
          sx={{
            textAlign: 'center',
            mb: { xs: 3, md: 4 },
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 0.1s ease',
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<PeopleIcon />}
            onClick={() => document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' })}
            sx={{
              px: { xs: 4, sm: 5 },
              py: 1.75,
              fontSize: { xs: '0.95rem', sm: '1.05rem' },
              fontWeight: 700,
              mb: 1.5,
            }}
          >
            도입 상담 신청 (1팀)
          </Button>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: '0.85rem',
            }}
          >
            단지 맞춤형 분석...
          </Typography>
        </Box>

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography
            variant="overline"
            sx={{
              color: goldColor,
              letterSpacing: '0.2em',
              fontSize: '0.7rem',
              mb: 2,
              display: 'block',
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.6s 0.2s ease',
            }}
          >
            CONTACT US
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '1.6rem', sm: '2rem', md: '2.8rem' },
              mb: 2,
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.3s ease',
            }}
          >
            오늘, 주차 스트레스에서{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${goldColor} 0%, ${goldLight} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              자유로워지세요
            </Box>
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 520,
              mx: 'auto',
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: 'all 0.6s 0.4s ease',
            }}
          >
            무료 단지 분석 리포트 + AI 추천 시뮬 데모를 제공합니다.<br />
            시공사·시행사·관리주체·정부기관 모두 환영합니다.
          </Typography>
        </Box>

        <Grid container spacing={4} sx={{ alignItems: 'flex-start' }}>
          {/* Left: Contact info */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateX(-20px)',
                transition: 'all 0.6s 0.5s ease',
              }}
            >
              <Box
                sx={{
                  p: 2.5,
                  background: contactDetailsBg,
                  border: contactDetailsBorder,
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: goldColor, fontSize: '0.8rem' }}>
                  주식회사 제이에이치홀딩스
                </Typography>
                {[
                  { icon: <EmailIcon sx={{ fontSize: 16 }} />, text: 'k3880@kakao.com' },
                  { icon: <PhoneIcon sx={{ fontSize: 16 }} />, text: '1666-0916' },
                  { icon: <FaxIcon sx={{ fontSize: 16 }} />, text: '02-6305-0044' },
                  { icon: <LocationOnIcon sx={{ fontSize: 16 }} />, text: '경기도 수원시 영통구 이의동 1338' },
                ].map((item) => (
                  <Box key={item.text} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}>
                    <Box sx={{ color: COLORS.SILVER, mt: 0.1, flexShrink: 0 }}>{item.icon}</Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                      {item.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>

          {/* Right: Form */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box
              component="form"
              onSubmit={handleSubmit}
              noValidate
              sx={{
                p: { xs: 3, md: 4 },
                background: formBg,
                border: formBorder,
                borderRadius: 3,
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateX(20px)',
                transition: 'all 0.6s 0.6s ease',
              }}
            >
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="회사명 *"
                    value={formData.company}
                    onChange={handleChange('company')}
                    error={!!errors.company}
                    helperText={errors.company}
                    placeholder="주식회사 ABC건설"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="담당자명 *"
                    value={formData.name}
                    onChange={handleChange('name')}
                    error={!!errors.name}
                    helperText={errors.name}
                    placeholder="홍길동 과장"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="연락처 *"
                    value={formData.phone}
                    onChange={handleChange('phone')}
                    error={!!errors.phone}
                    helperText={errors.phone}
                    placeholder="010-0000-0000"
                    type="tel"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="이메일 *"
                    value={formData.email}
                    onChange={handleChange('email')}
                    error={!!errors.email}
                    helperText={errors.email}
                    placeholder="hong@company.com"
                    type="email"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth error={!!errors.projectType}>
                    <InputLabel>프로젝트 유형 *</InputLabel>
                    <Select
                      value={formData.projectType}
                      label="프로젝트 유형 *"
                      onChange={handleChange('projectType')}
                    >
                      <MenuItem value="apartment">아파트 / 공동주택</MenuItem>
                      <MenuItem value="officetel">오피스텔</MenuItem>
                      <MenuItem value="mixed">주상복합</MenuItem>
                      <MenuItem value="industrial">지식산업센터</MenuItem>
                      <MenuItem value="retrofit">기존 단지 리모델링</MenuItem>
                      <MenuItem value="investment">투자 / 파트너십</MenuItem>
                      <MenuItem value="government">정부 / 지자체 협력</MenuItem>
                      <MenuItem value="other">기타</MenuItem>
                    </Select>
                    {errors.projectType && (
                      <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5, ml: 1.75, fontSize: '0.75rem' }}>
                        {errors.projectType}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="문의 내용 *"
                    value={formData.message}
                    onChange={handleChange('message')}
                    error={!!errors.message}
                    helperText={errors.message}
                    placeholder="프로젝트 규모, 예상 단지, 도입 일정, 궁금한 사항 등을 자유롭게 적어주세요."
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={submitting}
                    endIcon={submitting ? undefined : <SendIcon />}
                    sx={{
                      py: 1.75,
                      fontSize: '1rem',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::after': submitting
                        ? {
                            content: '""',
                            position: 'absolute',
                            inset: 0,
                            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)`,
                            backgroundSize: '200% auto',
                            animation: `${shimmer} 1.5s linear infinite`,
                          }
                        : {},
                    }}
                  >
                    {submitting ? '전송 중...' : '도입 문의 보내기'}
                  </Button>
                </Grid>
                {submitError && (
                  <Grid size={{ xs: 12 }}>
                    <Typography sx={{ color: 'error.main', fontSize: '0.875rem', textAlign: 'center' }}>
                      전송에 실패했습니다. 잠시 후 다시 시도해주세요.
                    </Typography>
                  </Grid>
                )}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
                    * 개인정보는 문의 처리 목적으로만 사용되며, 완료 후 즉시 파기됩니다.
                    문의 후 영업일 기준 1~2일 내 담당자가 연락드립니다.
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
