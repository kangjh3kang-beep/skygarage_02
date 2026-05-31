import { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { supabase } from '../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface ImageEditOverlayProps {
  slot: string;
  label: string;
  currentUrl: string;
  onImageChange: () => void;
  children: React.ReactNode;
  fillParent?: boolean;
}

export default function ImageEditOverlay({
  slot,
  label,
  currentUrl,
  onImageChange,
  children,
  fillParent = false,
}: ImageEditOverlayProps) {
  const { isAdmin } = useAdminAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAdmin) {
    return <>{children}</>;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('10MB 이하 파일만 업로드 가능합니다.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('JPG, PNG, WebP 형식만 지원합니다.');
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
    const path = `${slot}/${Date.now()}.${ext}`;

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

    const { data: newImage, error: dbError } = await supabase.from('site_images').insert({
      slot,
      url: publicUrl.publicUrl,
      alt: altText || file.name,
      filename: file.name,
      file_size: file.size,
      active: true,
    }).select('id').maybeSingle();

    if (dbError || !newImage) {
      setError(`저장 실패: ${dbError?.message ?? '알 수 없는 오류'}`);
      setUploading(false);
      return;
    }

    await supabase
      .from('site_images')
      .update({ active: false })
      .eq('slot', slot)
      .neq('id', newImage.id);

    setUploading(false);
    setSuccess('이미지가 적용되었습니다.');
    setFile(null);
    setPreview(null);
    setAltText('');
    onImageChange();
    setTimeout(() => {
      setSuccess('');
      setDialogOpen(false);
    }, 1500);
  };

  const handleDelete = async () => {
    if (!confirm('이 슬롯의 활성 이미지를 제거하시겠습니까?')) return;
    await supabase
      .from('site_images')
      .update({ active: false })
      .eq('slot', slot)
      .eq('active', true);
    onImageChange();
  };

  const handleClose = () => {
    setDialogOpen(false);
    setFile(null);
    setPreview(null);
    setAltText('');
    setError('');
    setSuccess('');
  };

  const hasImage = !!currentUrl;

  return (
    <Box
      sx={{
        position: fillParent ? 'absolute' : 'relative',
        ...(fillParent && { inset: 0, zIndex: 1 }),
        '&:hover > .admin-image-overlay': {
          opacity: 1,
          pointerEvents: 'auto',
          background: 'rgba(0,0,0,0.5)',
        },
      }}
    >
      {children}

      {/* Admin overlay */}
      <Box
        className="admin-image-overlay"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          background: 'transparent',
          opacity: 0,
          transition: 'all 0.3s ease',
          pointerEvents: 'none',
          borderRadius: 'inherit',
          zIndex: 10,
        }}
      >
        <Tooltip title={hasImage ? '이미지 교체' : '이미지 추가'}>
          <IconButton
            onClick={() => setDialogOpen(true)}
            sx={{
              bgcolor: 'rgba(201,168,76,0.9)',
              color: '#000',
              '&:hover': { bgcolor: 'rgba(201,168,76,1)' },
              width: 44,
              height: 44,
            }}
          >
            {hasImage ? <SwapHorizIcon /> : <CameraAltIcon />}
          </IconButton>
        </Tooltip>
        {hasImage && (
          <Tooltip title="이미지 제거">
            <IconButton
              onClick={handleDelete}
              sx={{
                bgcolor: 'rgba(211,47,47,0.9)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(211,47,47,1)' },
                width: 44,
                height: 44,
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Slot label badge */}
        <Chip
          label={label}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bgcolor: 'rgba(0,0,0,0.7)',
            color: '#fff',
            fontSize: '0.7rem',
            height: 24,
            fontWeight: 600,
          }}
        />
      </Box>

      {/* Upload dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {hasImage ? '이미지 교체' : '이미지 추가'} — {label}
        </DialogTitle>
        <DialogContent>
          {success && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {currentUrl && !preview && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                현재 이미지
              </Typography>
              <Box
                component="img"
                src={currentUrl}
                alt="현재 이미지"
                sx={{
                  width: '100%',
                  maxHeight: 160,
                  objectFit: 'cover',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            </Box>
          )}

          <TextField
            fullWidth
            label="대체 텍스트 (Alt)"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="이미지 설명을 입력하세요"
            size="small"
            sx={{ mb: 2 }}
          />

          <Button
            variant="outlined"
            component="label"
            fullWidth
            sx={{ py: 2, borderStyle: 'dashed', mb: 2 }}
          >
            {file ? file.name : '이미지 파일 선택 (JPG, PNG, WebP / 최대 10MB)'}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
            />
          </Button>

          {preview && (
            <Box
              component="img"
              src={preview}
              alt="미리보기"
              sx={{
                width: '100%',
                maxHeight: 200,
                objectFit: 'contain',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          )}

          {uploading && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>취소</Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {hasImage ? '교체' : '업로드'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
