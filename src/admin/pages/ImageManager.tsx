import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Slider from '@mui/material/Slider';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ImageIcon from '@mui/icons-material/Image';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import SaveIcon from '@mui/icons-material/Save';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { SITE_IMAGE_ASPECT_RATIOS, DEFAULT_ASPECT_RATIO } from '../../constants/imageLayout';

interface FocalData {
  x: number;
  y: number;
  scale: number;
}

interface SiteImage {
  id: string;
  slot: string;
  url: string;
  alt: string;
  filename: string;
  file_size: number;
  active: boolean;
  created_at: string;
  focal_point: FocalData | null;
}

interface SlotDefinition {
  value: string;
  label: string;
  description: string;
  section: string;
  aspectRatio: string;
}

const SECTION_LABELS: Record<string, string> = {
  hero: '히어로',
  painpoint: '페인포인트',
  solution: '솔루션',
  technology: 'ATR 기술',
  process: '프로세스',
  benefits: '장점',
  market: '시장',
  trust: '신뢰',
  comparison: '비교',
  modes: '운영모드',
  contact: '문의',
  brand: '브랜드',
};

const STATIC_SLOTS: SlotDefinition[] = [
  { value: 'hero-background', label: '히어로 배경', description: '메인 페이지 최상단 배경 (1920x1080)', section: 'hero', aspectRatio: '16/9' },
  { value: 'painpoint-visual', label: '페인포인트 비주얼', description: '주차 문제점 섹션', section: 'painpoint', aspectRatio: '4/1' },
  { value: 'solution-visual', label: '솔루션 비주얼', description: '통합 주차 솔루션', section: 'solution', aspectRatio: '16/9' },
  { value: 'technology-visual', label: 'ATR 메인', description: 'ATR 자율이송로봇 메인', section: 'technology', aspectRatio: '4/3' },
  { value: 'technology-detail', label: 'ATR 상세', description: 'ATR 로봇 클로즈업', section: 'technology', aspectRatio: '16/9' },
  { value: 'process-visual', label: '프로세스 비주얼', description: '프로세스 안내 배경', section: 'process', aspectRatio: '16/9' },
  { value: 'benefits-visual', label: '장점 비주얼', description: '세대직입 장점 표현', section: 'benefits', aspectRatio: '16/9' },
  { value: 'market-background', label: '시장 배경', description: '적용 시장 배경 (스카이라인)', section: 'market', aspectRatio: '3/1' },
  { value: 'market-apartment', label: '공동주택', description: '공동주택 적용 사례', section: 'market', aspectRatio: '16/9' },
  { value: 'market-officetel', label: '오피스텔', description: '오피스텔 적용 사례', section: 'market', aspectRatio: '16/9' },
  { value: 'market-mixed', label: '주상복합', description: '주상복합 적용 사례', section: 'market', aspectRatio: '16/9' },
  { value: 'trust-visual', label: '신뢰 비주얼', description: '회사 신뢰도 섹션', section: 'trust', aspectRatio: '16/9' },
  { value: 'contact-background', label: '문의 배경', description: '도입문의 섹션 배경', section: 'contact', aspectRatio: '3/1' },
  { value: 'brand-hero', label: '브랜드 히어로', description: '브랜드 가이드 페이지', section: 'brand', aspectRatio: '16/9' },
];

function getAspectRatioForSlot(slot: string): string {
  const staticMatch = STATIC_SLOTS.find((s) => s.value === slot);
  if (staticMatch) return staticMatch.aspectRatio;
  return SITE_IMAGE_ASPECT_RATIOS[slot] ?? DEFAULT_ASPECT_RATIO;
}

function getSectionForSlot(slot: string): string {
  const staticMatch = STATIC_SLOTS.find((s) => s.value === slot);
  if (staticMatch) return staticMatch.section;
  if (slot.startsWith('hero-stat')) return 'hero';
  if (slot.startsWith('benefit-')) return 'benefits';
  if (slot.startsWith('market-')) return 'market';
  if (slot.startsWith('trust-')) return 'trust';
  if (slot.startsWith('comparison-')) return 'comparison';
  if (slot.startsWith('mode-')) return 'modes';
  if (slot.startsWith('atr-feat-')) return 'technology';
  return 'other';
}

function getLabelForSlot(slot: string): string {
  const staticMatch = STATIC_SLOTS.find((s) => s.value === slot);
  if (staticMatch) return staticMatch.label;
  return slot.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function InlineFocalAdjuster({
  image,
  onSave,
}: {
  image: SiteImage;
  onSave: (id: string, focal: FocalData) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [focalX, setFocalX] = useState(image.focal_point?.x ?? 50);
  const [focalY, setFocalY] = useState(image.focal_point?.y ?? 50);
  const [scale, setScale] = useState(image.focal_point?.scale ?? 100);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 50, startY: 50 });

  const aspectRatio = getAspectRatioForSlot(image.slot);
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, startX: focalX, startY: focalY };
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
    const newX = clamp(dragStartRef.current.startX - pctX);
    const newY = clamp(dragStartRef.current.startY - pctY);
    setFocalX(newX);
    setFocalY(newY);
    setDirty(true);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleReset = () => {
    setFocalX(50);
    setFocalY(50);
    setScale(100);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(image.id, { x: focalX, y: focalY, scale });
    setDirty(false);
    setSaving(false);
  };

  const handleScaleChange = (_: Event, val: number | number[]) => {
    setScale(val as number);
    setDirty(true);
  };

  const imgScale = scale / 100;

  return (
    <Box>
      <Box
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio,
          maxHeight: 220,
          borderRadius: 1,
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'grab',
          border: 2,
          borderColor: dragging ? 'primary.main' : dirty ? 'warning.main' : 'divider',
          transition: 'border-color 0.2s',
          userSelect: 'none',
          touchAction: 'none',
          bgcolor: 'common.black',
        }}
      >
        <Box
          component="img"
          src={image.url}
          alt={image.alt}
          draggable={false}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: `${focalX}% ${focalY}%`,
            transform: imgScale > 1 ? `scale(${imgScale})` : undefined,
            transformOrigin: `${focalX}% ${focalY}%`,
            pointerEvents: 'none',
          }}
        />
        {/* Crosshair */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            opacity: dragging ? 1 : 0.5,
            transition: 'opacity 0.2s',
          }}
        >
          <Box sx={{ position: 'absolute', top: '50%', left: -10, width: 20, height: '1.5px', bgcolor: 'common.white', transform: 'translateY(-50%)', boxShadow: '0 0 4px rgba(0,0,0,0.9)' }} />
          <Box sx={{ position: 'absolute', left: '50%', top: -10, width: '1.5px', height: 20, bgcolor: 'common.white', transform: 'translateX(-50%)', boxShadow: '0 0 4px rgba(0,0,0,0.9)' }} />
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', border: '1.5px solid white', boxShadow: '0 0 4px rgba(0,0,0,0.7)' }} />
        </Box>
        {/* Label */}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            color: 'common.white',
            bgcolor: 'rgba(0,0,0,0.7)',
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
            fontSize: '0.6rem',
            pointerEvents: 'none',
            fontFamily: 'monospace',
          }}
        >
          {focalX}%, {focalY}%
        </Typography>
      </Box>

      {/* Scale + actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
        <ZoomOutIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Slider
          size="small"
          value={scale}
          min={100}
          max={300}
          step={5}
          onChange={handleScaleChange}
          sx={{ flex: 1, '& .MuiSlider-thumb': { width: 12, height: 12 }, '& .MuiSlider-track': { height: 2 }, '& .MuiSlider-rail': { height: 2 } }}
        />
        <ZoomInIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 28, textAlign: 'right', fontSize: '0.65rem' }}>
          {scale}%
        </Typography>
        <Tooltip title="중앙 리셋">
          <IconButton size="small" onClick={handleReset} sx={{ p: 0.25 }}>
            <CenterFocusStrongIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        {dirty && (
          <Tooltip title="저장">
            <IconButton size="small" color="primary" onClick={handleSave} disabled={saving} sx={{ p: 0.25 }}>
              <SaveIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default function ImageManager() {
  useDocumentTitle('이미지 관리');
  const [images, setImages] = useState<SiteImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>(STATIC_SLOTS[0].value);
  const [altText, setAltText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('site_images')
      .select('*')
      .order('created_at', { ascending: false });
    setImages(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const allSlots = (() => {
    const staticSlotValues = new Set(STATIC_SLOTS.map((s) => s.value));
    const dynamicSlots: SlotDefinition[] = [];
    for (const img of images) {
      if (!staticSlotValues.has(img.slot) && !dynamicSlots.some((d) => d.value === img.slot)) {
        dynamicSlots.push({
          value: img.slot,
          label: getLabelForSlot(img.slot),
          description: '',
          section: getSectionForSlot(img.slot),
          aspectRatio: getAspectRatioForSlot(img.slot),
        });
      }
    }
    return [...STATIC_SLOTS, ...dynamicSlots];
  })();

  const sections = (() => {
    const sectionMap = new Map<string, SlotDefinition[]>();
    for (const slot of allSlots) {
      const section = slot.section;
      if (!sectionMap.has(section)) sectionMap.set(section, []);
      sectionMap.get(section)!.push(slot);
    }
    return Array.from(sectionMap.entries()).map(([key, slots]) => ({
      key,
      label: SECTION_LABELS[key] ?? key,
      slots,
    }));
  })();

  const sectionTabs = [{ key: 'all', label: '전체' }, ...sections.map((s) => ({ key: s.key, label: s.label }))];
  const filteredSections = activeTab === 0 ? sections : [sections[activeTab - 1]].filter(Boolean);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('JPG, PNG, WebP 형식만 업로드 가능합니다.');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');

    const ext = file.name.split('.').pop();
    const path = `${selectedSlot}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('site-assets')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      setError(`업로드 실패: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from('site-assets')
      .getPublicUrl(path);

    const { error: dbError } = await supabase.from('site_images').insert({
      slot: selectedSlot,
      url: publicUrl.publicUrl,
      alt: altText || file.name,
      filename: file.name,
      file_size: file.size,
      active: false,
    });

    if (dbError) {
      setError(`데이터 저장 실패: ${dbError.message}`);
      setUploading(false);
      return;
    }

    setUploading(false);
    setUploadOpen(false);
    setFile(null);
    setPreview(null);
    setAltText('');
    setSuccess('이미지가 업로드되었습니다.');
    fetchImages();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleActivate = async (image: SiteImage) => {
    await supabase
      .from('site_images')
      .update({ active: false })
      .eq('slot', image.slot);
    await supabase
      .from('site_images')
      .update({ active: true })
      .eq('id', image.id);
    setSuccess(`"${getLabelForSlot(image.slot)}" 이미지가 활성화되었습니다.`);
    fetchImages();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDeactivate = async (image: SiteImage) => {
    await supabase
      .from('site_images')
      .update({ active: false })
      .eq('id', image.id);
    fetchImages();
  };

  const handleDelete = async (image: SiteImage) => {
    if (!confirm('이 이미지를 삭제하시겠습니까?')) return;
    const pathMatch = image.url.match(/site-assets\/(.+)$/);
    if (pathMatch) {
      await supabase.storage.from('site-assets').remove([pathMatch[1]]);
    }
    await supabase.from('site_images').delete().eq('id', image.id);
    fetchImages();
  };

  const handleFocalSave = async (id: string, focal: FocalData) => {
    await supabase.from('site_images').update({ focal_point: focal }).eq('id', id);
    setSuccess('초점 위치가 저장되었습니다.');
    fetchImages();
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, fontSize: { xs: '1.2rem', sm: '1.5rem' } }}>
            사이트 이미지 관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
            프론트엔드 각 섹션 이미지를 관리합니다. 드래그로 표시 영역을 조정하세요.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={() => setUploadOpen(true)}
          sx={{ flexShrink: 0, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
        >
          이미지 업로드
        </Button>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && !uploadOpen && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Section tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { fontSize: '0.78rem', minHeight: 40, py: 1 } }}
      >
        {sectionTabs.map((tab) => (
          <Tab key={tab.key} label={tab.label} />
        ))}
      </Tabs>

      {loading ? (
        <LinearProgress />
      ) : (
        filteredSections.map((section) => (
          <Box key={section.key} sx={{ mb: 4 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', color: 'text.primary' }}>
              {section.label} 섹션
            </Typography>
            <Grid container spacing={2}>
              {section.slots.map((slot) => {
                const slotImages = images.filter((img) => img.slot === slot.value);
                const activeImage = slotImages.find((img) => img.active);

                return (
                  <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={slot.value}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: '100%',
                        borderColor: activeImage ? 'success.main' : 'divider',
                        bgcolor: activeImage ? 'rgba(46,125,50,0.02)' : 'background.paper',
                      }}
                    >
                      <CardContent sx={{ pb: 1 }}>
                        {/* Slot header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                          {activeImage ? (
                            <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                          ) : (
                            <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                          )}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                              {slot.label}
                            </Typography>
                            {slot.description && (
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.65rem', display: 'block' }}>
                                {slot.description}
                              </Typography>
                            )}
                          </Box>
                          <Chip
                            label={`${slot.aspectRatio}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.6rem', height: 18 }}
                          />
                        </Box>

                        {/* Focal point adjuster or empty state */}
                        {activeImage ? (
                          <InlineFocalAdjuster image={activeImage} onSave={handleFocalSave} />
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              aspectRatio: slot.aspectRatio,
                              maxHeight: 220,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'action.hover',
                              borderRadius: 1,
                              border: '1px dashed',
                              borderColor: 'divider',
                            }}
                          >
                            <ImageIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                              이미지 미설정
                            </Typography>
                          </Box>
                        )}

                        {/* File info */}
                        {activeImage && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.65rem', mt: 0.75, display: 'block' }}>
                            {activeImage.filename} ({formatFileSize(activeImage.file_size)})
                          </Typography>
                        )}
                      </CardContent>

                      <CardActions sx={{ px: 1.5, py: 1, justifyContent: 'space-between' }}>
                        {slotImages.length > 1 && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            {slotImages.length}개 이미지
                          </Typography>
                        )}
                        {!slotImages.length && <Box />}
                        {activeImage && (
                          <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                            <Tooltip title="비활성화">
                              <Button size="small" color="warning" onClick={() => handleDeactivate(activeImage)} sx={{ fontSize: '0.7rem', minWidth: 0, px: 1 }}>
                                해제
                              </Button>
                            </Tooltip>
                            <Tooltip title="삭제">
                              <IconButton size="small" color="error" onClick={() => handleDelete(activeImage)}>
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </CardActions>

                      {/* Additional images for this slot */}
                      {slotImages.filter((img) => !img.active).length > 0 && (
                        <Box sx={{ px: 1.5, pb: 1.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 600, mb: 0.5, display: 'block' }}>
                            비활성 이미지
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                            {slotImages.filter((img) => !img.active).map((img) => (
                              <Box key={img.id} sx={{ position: 'relative', width: 56, height: 40, borderRadius: 0.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider', cursor: 'pointer', '&:hover': { borderColor: 'success.main' } }}>
                                <Box
                                  component="img"
                                  src={img.url}
                                  alt={img.alt}
                                  onClick={() => handleActivate(img)}
                                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <Tooltip title="삭제">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                                    sx={{ position: 'absolute', top: -4, right: -4, p: 0.2, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 10 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ))
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>이미지 업로드</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="적용 슬롯"
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          >
            {allSlots.map((slot) => (
              <MenuItem key={slot.value} value={slot.value}>
                [{SECTION_LABELS[slot.section] ?? slot.section}] {slot.label}
                {slot.description && ` — ${slot.description}`}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="대체 텍스트 (Alt)"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="이미지 설명을 입력하세요"
            sx={{ mb: 2 }}
          />

          <Button
            variant="outlined"
            component="label"
            fullWidth
            sx={{ py: 2, mb: 2, borderStyle: 'dashed' }}
          >
            {file ? file.name : '이미지 파일 선택 (JPG, PNG, WebP / 최대 10MB)'}
            <input
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
            />
          </Button>

          {preview && (
            <Box
              component="img"
              src={preview}
              alt="Preview"
              sx={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
            />
          )}

          {uploading && <LinearProgress sx={{ mt: 2 }} />}
          {error && uploadOpen && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleUpload} disabled={!file || uploading}>
            업로드
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
