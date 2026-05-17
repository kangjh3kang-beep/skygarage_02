import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteIcon from '@mui/icons-material/Delete';
import { supabase } from '../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface BadgeImageZoneProps {
  slot: string;
  position: 'top' | 'bottom';
  imageUrl: string;
  onImageChange: () => void;
  height?: number | { xs?: number; sm?: number; md?: number };
}

export default function BadgeImageZone({
  slot,
  position,
  imageUrl,
  onImageChange,
  height = { xs: 48, sm: 56, md: 64 },
}: BadgeImageZoneProps) {
  const { isAdmin } = useAdminAuth();
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const fullSlot = `${slot}-${position}`;
  const displayUrl = localPreview || imageUrl;

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;

      const preview = URL.createObjectURL(file);
      setLocalPreview(preview);
      setUploading(true);

      const ext = file.name.split('.').pop();
      const path = `${fullSlot}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        setLocalPreview(null);
        setUploading(false);
        return;
      }

      const { data: publicUrl } = supabase.storage
        .from('site-assets')
        .getPublicUrl(path);

      const { data: newImage } = await supabase.from('site_images').insert({
        slot: fullSlot,
        url: publicUrl.publicUrl,
        alt: file.name,
        filename: file.name,
        file_size: file.size,
        active: true,
      }).select('id').maybeSingle();

      if (newImage) {
        await supabase
          .from('site_images')
          .update({ active: false })
          .eq('slot', fullSlot)
          .neq('id', newImage.id);
      }

      setUploading(false);
      setLocalPreview(null);
      onImageChange();
    },
    [fullSlot, onImageChange],
  );

  const handleDelete = useCallback(async () => {
    await supabase
      .from('site_images')
      .update({ active: false })
      .eq('slot', fullSlot)
      .eq('active', true);
    setLocalPreview(null);
    onImageChange();
  }, [fullSlot, onImageChange]);

  if (!displayUrl && !isAdmin) return null;

  if (displayUrl) {
    return (
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height,
          overflow: 'hidden',
          ...(position === 'top' && { borderRadius: '10px 10px 0 0' }),
          ...(position === 'bottom' && { borderRadius: '0 0 10px 10px' }),
          '&:hover .zone-controls': { opacity: 1 },
        }}
      >
        <Box
          component="img"
          src={displayUrl}
          alt=""
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: uploading ? 0.5 : 1,
            transition: 'opacity 0.3s ease',
          }}
        />
        {isAdmin && (
          <Box
            className="zone-controls"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              bgcolor: 'rgba(0,0,0,0.5)',
              opacity: 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            <Tooltip title="이미지 교체">
              <IconButton
                component="label"
                size="small"
                sx={{ bgcolor: 'rgba(201,168,76,0.9)', color: '#000', '&:hover': { bgcolor: 'rgba(201,168,76,1)' } }}
              >
                <AddPhotoAlternateIcon sx={{ fontSize: 18 }} />
                <input
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                />
              </IconButton>
            </Tooltip>
            <Tooltip title="이미지 삭제">
              <IconButton
                size="small"
                onClick={handleDelete}
                sx={{ bgcolor: 'rgba(211,47,47,0.9)', color: '#fff', '&:hover': { bgcolor: 'rgba(211,47,47,1)' } }}
              >
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    );
  }

  if (isAdmin) {
    return (
      <Box
        component="label"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          width: '100%',
          height: { xs: 36, sm: 40 },
          cursor: 'pointer',
          bgcolor: 'rgba(201,168,76,0.06)',
          border: '1px dashed rgba(201,168,76,0.3)',
          ...(position === 'top' && { borderRadius: '10px 10px 0 0' }),
          ...(position === 'bottom' && { borderRadius: '0 0 10px 10px' }),
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: 'rgba(201,168,76,0.12)',
            borderColor: 'rgba(201,168,76,0.6)',
          },
        }}
      >
        <AddPhotoAlternateIcon sx={{ fontSize: 16, color: 'rgba(201,168,76,0.7)' }} />
        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(201,168,76,0.7)', fontWeight: 600 }}>
          {position === 'top' ? '상단' : '하단'} 이미지
        </Typography>
        <input
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
        />
      </Box>
    );
  }

  return null;
}
