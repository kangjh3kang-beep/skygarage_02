import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
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
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ImageIcon from '@mui/icons-material/Image';
import CropIcon from '@mui/icons-material/Crop';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import FocalPointPicker from '../components/FocalPointPicker';
import type { FocalPoint } from '../components/FocalPointPicker';

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

const IMAGE_SLOTS = [
  { value: 'hero-background', label: '히어로 배경', description: '메인 페이지 최상단 배경 이미지 (1920x1080 권장)' },
  { value: 'painpoint-visual', label: '페인포인트 비주얼', description: '주차장 문제점 섹션 이미지' },
  { value: 'solution-visual', label: '솔루션 비주얼', description: '통합 주차 솔루션 일러스트/사진' },
  { value: 'technology-visual', label: 'ATR 기술 비주얼', description: 'ATR 자율이송로봇 메인 이미지' },
  { value: 'technology-detail', label: 'ATR 상세 이미지', description: 'ATR 로봇 상세/클로즈업 이미지' },
  { value: 'process-visual', label: '프로세스 비주얼', description: '프로세스 안내 섹션 배경/삽화' },
  { value: 'benefits-visual', label: '장점 섹션 비주얼', description: '세대직입 장점 표현 이미지' },
  { value: 'market-background', label: '시장 섹션 배경', description: '적용 시장 섹션 배경 (도시 스카이라인)' },
  { value: 'market-apartment', label: '시장 - 공동주택', description: '공동주택 적용 사례 이미지' },
  { value: 'market-officetel', label: '시장 - 오피스텔', description: '오피스텔 적용 사례 이미지' },
  { value: 'market-mixed', label: '시장 - 주상복합', description: '주상복합/지산센터 적용 사례 이미지' },
  { value: 'trust-visual', label: '신뢰 섹션 비주얼', description: '회사 신뢰도 섹션 이미지' },
  { value: 'contact-background', label: '문의 섹션 배경', description: '도입문의 섹션 배경 이미지' },
  { value: 'brand-hero', label: '브랜드 히어로', description: '브랜드 가이드 페이지 히어로' },
] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImageManager() {
  useDocumentTitle('이미지 관리');
  const navigate = useNavigate();
  const [images, setImages] = useState<SiteImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>(IMAGE_SLOTS[0].value);
  const [altText, setAltText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [focalTarget, setFocalTarget] = useState<SiteImage | null>(null);
  const [focalValue, setFocalValue] = useState<FocalPoint>({ x: 50, y: 50 });
  const [focalScale, setFocalScale] = useState(100);

  const fetchImages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('site_images')
      .select('*')
      .order('created_at', { ascending: false });
    setImages(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchImages();
  }, []);

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

    setSuccess(`"${getSlotLabel(image.slot)}" 슬롯에 이미지가 활성화되었습니다.`);
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

  const openFocalPicker = (image: SiteImage) => {
    setFocalTarget(image);
    setFocalValue(image.focal_point ? { x: image.focal_point.x, y: image.focal_point.y } : { x: 50, y: 50 });
    setFocalScale(image.focal_point?.scale ?? 100);
  };

  const handleFocalSave = async () => {
    if (!focalTarget) return;
    const data: FocalData = { x: focalValue.x, y: focalValue.y, scale: focalScale };
    await supabase.from('site_images').update({ focal_point: data }).eq('id', focalTarget.id);
    setFocalTarget(null);
    setSuccess('초점 위치가 저장되었습니다.');
    fetchImages();
    setTimeout(() => setSuccess(''), 3000);
  };

  const getSlotLabel = (slot: string) =>
    IMAGE_SLOTS.find((s) => s.value === slot)?.label ?? slot;

  const activeSlots = IMAGE_SLOTS.map((slot) => ({
    ...slot,
    activeImage: images.find((img) => img.slot === slot.value && img.active),
  }));

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, fontSize: { xs: '1.2rem', sm: '1.5rem' } }}>
            사이트 이미지 관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
            랜딩 페이지 각 섹션에 표시되는 이미지를 업로드하고 관리합니다.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/media')}>섹션 미디어</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/settings')}>설정</Button>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => setUploadOpen(true)}
            sx={{ flexShrink: 0, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
          >
            이미지 업로드
          </Button>
        </Box>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Slot status overview */}
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: 'text.secondary' }}>
        슬롯 현황
      </Typography>
      <Grid container spacing={1.5} sx={{ mb: 4 }}>
        {activeSlots.map((slot) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={slot.value}>
            <Card
              variant="outlined"
              sx={{
                borderColor: slot.activeImage ? 'success.main' : 'divider',
                bgcolor: slot.activeImage ? 'rgba(46,125,50,0.04)' : 'background.paper',
              }}
            >
              <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  {slot.activeImage ? (
                    <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', flexShrink: 0 }} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      {slot.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.68rem', display: 'block' }}>
                      {slot.description}
                    </Typography>
                  </Box>
                  <Chip
                    label={slot.activeImage ? '활성' : '미설정'}
                    size="small"
                    color={slot.activeImage ? 'success' : 'default'}
                    sx={{ fontSize: '0.65rem', height: 20, flexShrink: 0 }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Image grid */}
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: 'text.secondary' }}>
        업로드된 이미지 ({images.length})
      </Typography>

      {loading ? (
        <LinearProgress />
      ) : images.length === 0 ? (
        <Card variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <ImageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">업로드된 이미지가 없습니다.</Typography>
          <Typography variant="caption" color="text.disabled">
            상단의 "이미지 업로드" 버튼을 클릭하여 이미지를 추가하세요.
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={1.5}>
          {images.map((image) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={image.id}>
              <Card variant="outlined" sx={{ position: 'relative' }}>
                {image.active && (
                  <Chip
                    label="활성"
                    color="success"
                    size="small"
                    sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, fontSize: '0.68rem' }}
                  />
                )}
                <CardMedia
                  component="img"
                  image={image.url}
                  alt={image.alt}
                  sx={{ objectFit: 'cover', height: { xs: 140, sm: 160 }, width: '100%' }}
                />
                <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1 } }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 0.25 }} noWrap>
                    {image.filename}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem', display: 'block' }}>
                    {getSlotLabel(image.slot)} · {formatFileSize(image.file_size)}
                  </Typography>
                </CardContent>
                <CardActions sx={{ px: 1.5, py: 1, justifyContent: 'space-between' }}>
                  {image.active ? (
                    <Button
                      size="small"
                      color="warning"
                      onClick={() => handleDeactivate(image)}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      비활성화
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      color="success"
                      onClick={() => handleActivate(image)}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      활성화
                    </Button>
                  )}
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="초점 조정">
                      <IconButton size="small" color="primary" onClick={() => openFocalPicker(image)}>
                        <CropIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="삭제">
                      <IconButton size="small" color="error" onClick={() => handleDelete(image)}>
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
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
            {IMAGE_SLOTS.map((slot) => (
              <MenuItem key={slot.value} value={slot.value}>
                {slot.label} — {slot.description}
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
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleUpload} disabled={!file || uploading}>
            업로드
          </Button>
        </DialogActions>
      </Dialog>

      {/* Focal point dialog */}
      <Dialog open={!!focalTarget} onClose={() => setFocalTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>초점 위치 조정</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            이미지를 클릭하거나 드래그하여 프론트엔드에서 보여질 초점 위치를 지정합니다.
          </Typography>
          {focalTarget && (
            <FocalPointPicker
              imageUrl={focalTarget.url}
              value={focalValue}
              onChange={setFocalValue}
              scale={focalScale}
              onScaleChange={setFocalScale}
              slot={focalTarget.slot}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFocalTarget(null)}>취소</Button>
          <Button variant="contained" onClick={handleFocalSave}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
