import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import LoopIcon from '@mui/icons-material/Loop';
import TuneIcon from '@mui/icons-material/Tune';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useToast } from '../contexts/ToastContext';
import FocalPointPicker from '../components/FocalPointPicker';

interface FocalData {
  x: number;
  y: number;
  scale: number;
}

interface MediaItem {
  url: string;
  alt?: string;
  video_url?: string;
}

interface PlaybackSettings {
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  show_controls: boolean;
  play_mode: 'sequential' | 'manual';
  transition_delay: number;
}

const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  autoplay: true,
  muted: true,
  loop: true,
  show_controls: false,
  play_mode: 'sequential',
  transition_delay: 1,
};

interface SectionMedia {
  id: string;
  position: string;
  layout: string;
  media_type: string;
  items: MediaItem[];
  sort_order: number;
  active: boolean;
  created_at: string;
  playback_settings?: PlaybackSettings;
  focal_points?: FocalData[];
}

const SECTION_POSITIONS = [
  { value: 'after_hero', label: 'Hero 섹션 뒤' },
  { value: 'after_brand_story', label: 'Brand Story 섹션 뒤' },
  { value: 'after_pain_point', label: 'Pain Point 섹션 뒤' },
  { value: 'after_comparison', label: 'Comparison 섹션 뒤' },
  { value: 'after_solution', label: 'Solution 섹션 뒤' },
  { value: 'after_three_modes', label: 'Three Modes 섹션 뒤' },
  { value: 'after_atr', label: 'ATR 섹션 뒤' },
  { value: 'after_process', label: 'Process 섹션 뒤' },
  { value: 'after_benefits', label: 'Benefits 섹션 뒤' },
  { value: 'after_market', label: 'Market 섹션 뒤' },
  { value: 'after_trust', label: 'Trust 섹션 뒤' },
];

const LAYOUT_OPTIONS = [
  { value: '1col', label: '1열 (전체 너비)' },
  { value: '2col', label: '2열 배치' },
  { value: '3col', label: '3열 배치' },
];

interface FormData {
  position: string;
  layout: string;
  media_type: string;
  items: MediaItem[];
  sort_order: number;
  active: boolean;
  playback_settings: PlaybackSettings;
  focal_points: FocalData[];
}

const emptyForm: FormData = {
  position: 'after_hero',
  layout: '1col',
  media_type: 'image',
  items: [{ url: '', alt: '' }],
  sort_order: 0,
  active: true,
  playback_settings: { ...DEFAULT_PLAYBACK_SETTINGS },
  focal_points: [{ x: 50, y: 50, scale: 100 }],
};

export default function SectionMediaManager() {
  useDocumentTitle('섹션 미디어 관리');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const [mediaList, setMediaList] = useState<SectionMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SectionMedia | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [uploading, setUploading] = useState(false);

  const loadData = useCallback(async () => {
    const { data, error } = await supabase
      .from('section_media')
      .select('*')
      .order('position')
      .order('sort_order', { ascending: true });
    if (error) console.error('[SectionMedia]', error.message);
    if (data) setMediaList(data as SectionMedia[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('section-media-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'section_media' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (media: SectionMedia) => {
    setEditingId(media.id);
    const items = media.items.length > 0 ? media.items : [{ url: '', alt: '' }];
    const defaultFocals: FocalData[] = items.map(() => ({ x: 50, y: 50, scale: 100 }));
    setForm({
      position: media.position,
      layout: media.layout,
      media_type: media.media_type,
      items,
      sort_order: media.sort_order,
      active: media.active,
      playback_settings: media.playback_settings || { ...DEFAULT_PLAYBACK_SETTINGS },
      focal_points: media.focal_points && media.focal_points.length > 0
        ? media.focal_points.map((fp) => ({ x: fp.x, y: fp.y, scale: fp.scale ?? 100 }))
        : defaultFocals,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const validItems = form.items.filter((item) => item.url.trim() || item.video_url?.trim());
    if (validItems.length === 0) {
      showToast('최소 1개의 미디어를 등록해주세요.', 'error');
      return;
    }

    const payload = {
      position: form.position,
      layout: form.layout,
      media_type: form.media_type,
      items: validItems,
      sort_order: form.sort_order,
      active: form.active,
      playback_settings: form.media_type === 'video' ? form.playback_settings : null,
      focal_points: form.media_type === 'image' ? form.focal_points.slice(0, validItems.length) : null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('section_media').update(payload).eq('id', editingId);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'section_media', editingId, { position: payload.position });
      showToast('미디어가 수정되었습니다.', 'success');
    } else {
      const { data, error } = await supabase.from('section_media').insert(payload).select('id').single();
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'section_media', data?.id, { position: payload.position });
      showToast('미디어가 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('section_media').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('삭제 실패: ' + error.message, 'error');
    } else {
      showToast('미디어가 삭제되었습니다.', 'success');
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    loadData();
  };

  const handleFileUpload = async (index: number, file: File, isVideo: boolean) => {
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `${isVideo ? 'videos' : 'images'}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from('section-media').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      showToast('업로드 실패: ' + error.message, 'error');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('section-media').getPublicUrl(path);
    const newItems = [...form.items];
    if (isVideo) {
      newItems[index] = { ...newItems[index], url: urlData.publicUrl, video_url: urlData.publicUrl };
    } else {
      newItems[index] = { ...newItems[index], url: urlData.publicUrl };
    }
    setForm({ ...form, items: newItems });
    setUploading(false);
    showToast('파일이 업로드되었습니다.', 'success');
  };

  const getMaxItems = () => {
    if (form.media_type === 'video') return 3;
    switch (form.layout) {
      case '3col': return 3;
      case '2col': return 2;
      default: return 1;
    }
  };

  const updateItemCount = (newLayout: string, newType: string) => {
    let max: number;
    if (newType === 'video') {
      max = 3;
    } else {
      max = newLayout === '3col' ? 3 : newLayout === '2col' ? 2 : 1;
    }
    const newItems = [...form.items];
    while (newItems.length < max) newItems.push({ url: '', alt: '' });
    while (newItems.length > max) newItems.pop();

    const newFocals = [...form.focal_points];
    while (newFocals.length < max) newFocals.push({ x: 50, y: 50, scale: 100 });
    while (newFocals.length > max) newFocals.pop();
    setForm((prev) => ({ ...prev, focal_points: newFocals }));

    return newItems;
  };

  const addVideoSlot = () => {
    if (form.items.length < 3) {
      setForm({ ...form, items: [...form.items, { url: '', alt: '', video_url: '' }] });
    }
  };

  const removeVideoSlot = (index: number) => {
    if (form.items.length > 1) {
      const newItems = form.items.filter((_, i) => i !== index);
      setForm({ ...form, items: newItems });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#00d4ff' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h1">섹션 미디어 관리</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            랜딩페이지 섹션 사이에 이미지/영상을 배치합니다 (영상: 최대 3개 순차 재생)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/images')}>이미지 관리</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
            sx={{ bgcolor: '#00d4ff', '&:hover': { bgcolor: '#00b8e6' } }}>
            미디어 추가
          </Button>
        </Box>
      </Box>

      {mediaList.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <ImageIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.15)', mb: 2 }} />
            <Typography sx={{ color: 'text.secondary' }}>등록된 섹션 미디어가 없습니다.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {mediaList.map((media) => {
            const posLabel = SECTION_POSITIONS.find((p) => p.value === media.position)?.label || media.position;
            return (
              <Grid key={media.id} size={{ xs: 12, md: 6 }}>
                <Card sx={{ opacity: media.active ? 1 : 0.5 }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', mb: 0.5 }}>
                          {posLabel}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            icon={media.media_type === 'video' ? <VideoLibraryIcon sx={{ fontSize: 14 }} /> : <ImageIcon sx={{ fontSize: 14 }} />}
                            label={media.media_type === 'video' ? '영상' : '이미지'}
                            sx={{ fontSize: '0.7rem' }}
                          />
                          {media.media_type === 'video' && media.items.length > 1 && (
                            <Chip
                              size="small"
                              icon={<PlaylistPlayIcon sx={{ fontSize: 14 }} />}
                              label={`${media.items.length}개 ${media.playback_settings?.play_mode === 'manual' ? '수동재생' : '순차재생'}`}
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                          {media.media_type === 'video' && media.playback_settings?.autoplay && (
                            <Chip
                              size="small"
                              icon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
                              label="자동재생"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                          {media.media_type === 'image' && (
                            <Chip
                              size="small"
                              icon={<ViewColumnIcon sx={{ fontSize: 14 }} />}
                              label={LAYOUT_OPTIONS.find((l) => l.value === media.layout)?.label || media.layout}
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                          {!media.active && (
                            <Chip size="small" label="비활성" color="error" sx={{ fontSize: '0.7rem' }} />
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => openEdit(media)} sx={{ color: '#00d4ff' }}>
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => { setDeleteTarget(media); setDeleteDialogOpen(true); }} sx={{ color: '#ff5252' }}>
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </Box>

                    {/* Preview */}
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                      {media.items.slice(0, 3).map((item, idx) => (
                        <Box key={idx} sx={{ flex: 1, borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {media.media_type === 'video' ? (
                            item.url && !item.url.includes('youtube') && !item.url.includes('vimeo') ? (
                              <Box component="video" src={item.video_url || item.url}
                                sx={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <Box sx={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.3)' }}>
                                <VideoLibraryIcon sx={{ color: 'rgba(255,255,255,0.4)' }} />
                              </Box>
                            )
                          ) : item.url ? (
                            <Box component="img" src={item.url} alt={item.alt || ''} sx={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <Box sx={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.2)' }}>
                              <ImageIcon sx={{ color: 'rgba(255,255,255,0.2)' }} />
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? '미디어 수정' : '미디어 추가'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <FormControl fullWidth>
              <InputLabel>위치 (섹션 뒤)</InputLabel>
              <Select value={form.position} label="위치 (섹션 뒤)"
                onChange={(e) => setForm({ ...form, position: e.target.value })}>
                {SECTION_POSITIONS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>미디어 유형</InputLabel>
              <Select value={form.media_type} label="미디어 유형"
                onChange={(e) => {
                  const newType = e.target.value;
                  const newItems = updateItemCount(form.layout, newType);
                  setForm({ ...form, media_type: newType, items: newItems });
                }}>
                <MenuItem value="image">이미지</MenuItem>
                <MenuItem value="video">영상 (파일 업로드 / URL)</MenuItem>
              </Select>
            </FormControl>

            {form.media_type === 'image' && (
              <FormControl fullWidth>
                <InputLabel>레이아웃</InputLabel>
                <Select value={form.layout} label="레이아웃"
                  onChange={(e) => {
                    const newLayout = e.target.value;
                    const newItems = updateItemCount(newLayout, form.media_type);
                    setForm({ ...form, layout: newLayout, items: newItems });
                  }}>
                  {LAYOUT_OPTIONS.map((l) => (
                    <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {form.media_type === 'video' && (
              <>
                <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#00d4ff', fontWeight: 600, mb: 0.5 }}>
                    순차 재생 모드
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    최대 3개의 영상을 등록할 수 있으며, 등록 순서대로 자동 순차 재생됩니다.
                    영상 파일을 직접 업로드하거나 YouTube/Vimeo URL을 입력하세요.
                  </Typography>
                </Box>

                {/* Playback Settings */}
                <Card variant="outlined" sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.08)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <TuneIcon sx={{ fontSize: 18, color: '#00d4ff' }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      재생 설정
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>재생 모드</InputLabel>
                        <Select
                          value={form.playback_settings.play_mode}
                          label="재생 모드"
                          onChange={(e) => setForm({
                            ...form,
                            playback_settings: { ...form.playback_settings, play_mode: e.target.value as 'sequential' | 'manual' },
                          })}
                        >
                          <MenuItem value="sequential">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PlayArrowIcon sx={{ fontSize: 16 }} />
                              자동 순차 재생
                            </Box>
                          </MenuItem>
                          <MenuItem value="manual">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <TouchAppIcon sx={{ fontSize: 16 }} />
                              수동 선택 재생
                            </Box>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                      <Tooltip title="페이지 로드 시 또는 화면에 보일 때 자동으로 재생 시작">
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={form.playback_settings.autoplay}
                              onChange={(e) => setForm({
                                ...form,
                                playback_settings: { ...form.playback_settings, autoplay: e.target.checked },
                              })}
                            />
                          }
                          label={<Typography sx={{ fontSize: '0.8rem' }}>자동 재생</Typography>}
                        />
                      </Tooltip>
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                      <Tooltip title="영상 시작 시 음소거 상태로 재생 (자동재생 시 필수)">
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={form.playback_settings.muted}
                              onChange={(e) => setForm({
                                ...form,
                                playback_settings: { ...form.playback_settings, muted: e.target.checked },
                              })}
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {form.playback_settings.muted
                                ? <VolumeOffIcon sx={{ fontSize: 14 }} />
                                : <VolumeUpIcon sx={{ fontSize: 14 }} />}
                              <Typography sx={{ fontSize: '0.8rem' }}>음소거</Typography>
                            </Box>
                          }
                        />
                      </Tooltip>
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                      <Tooltip title="마지막 영상 재생 후 처음부터 다시 반복">
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={form.playback_settings.loop}
                              onChange={(e) => setForm({
                                ...form,
                                playback_settings: { ...form.playback_settings, loop: e.target.checked },
                              })}
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LoopIcon sx={{ fontSize: 14 }} />
                              <Typography sx={{ fontSize: '0.8rem' }}>반복 재생</Typography>
                            </Box>
                          }
                        />
                      </Tooltip>
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                      <Tooltip title="재생/일시정지, 볼륨, 진행바 등 브라우저 기본 컨트롤 표시">
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={form.playback_settings.show_controls}
                              onChange={(e) => setForm({
                                ...form,
                                playback_settings: { ...form.playback_settings, show_controls: e.target.checked },
                              })}
                            />
                          }
                          label={<Typography sx={{ fontSize: '0.8rem' }}>컨트롤 표시</Typography>}
                        />
                      </Tooltip>
                    </Grid>

                    {form.playback_settings.play_mode === 'sequential' && (
                      <Grid size={{ xs: 12 }}>
                        <Divider sx={{ my: 0.5 }} />
                        <TextField
                          fullWidth
                          label="영상 전환 대기 시간 (초)"
                          type="number"
                          value={form.playback_settings.transition_delay}
                          onChange={(e) => setForm({
                            ...form,
                            playback_settings: { ...form.playback_settings, transition_delay: Math.max(0, Number(e.target.value)) },
                          })}
                          size="small"
                          slotProps={{ htmlInput: { min: 0, max: 10, step: 0.5 } }}
                          helperText="영상이 끝난 후 다음 영상까지 대기 시간 (0 = 즉시 전환)"
                        />
                      </Grid>
                    )}
                  </Grid>
                </Card>
              </>
            )}

            {/* Upload progress */}
            {uploading && (
              <LinearProgress
                sx={{
                  borderRadius: 1,
                  '& .MuiLinearProgress-bar': { bgcolor: '#00d4ff' },
                }}
              />
            )}

            {/* Media items */}
            {form.items.slice(0, getMaxItems()).map((item, idx) => (
              <Card key={idx} variant="outlined" sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.1)', position: 'relative' }}>
                {form.media_type === 'video' && form.items.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => removeVideoSlot(idx)}
                    sx={{ position: 'absolute', top: 8, right: 8, color: '#ff5252' }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}

                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, mb: 1.5, color: 'text.secondary' }}>
                  {form.media_type === 'video' ? `영상 ${idx + 1}` : `이미지 ${idx + 1}`}
                  {form.media_type === 'video' && form.items.length > 1 && (
                    <Chip label={`${idx + 1}번째 재생`} size="small" sx={{ ml: 1, fontSize: '0.65rem', height: 20 }} />
                  )}
                </Typography>

                {form.media_type === 'video' ? (
                  <>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                      <TextField
                        fullWidth
                        label="영상 URL (YouTube, Vimeo 또는 직접 URL)"
                        value={item.video_url || item.url}
                        onChange={(e) => {
                          const newItems = [...form.items];
                          newItems[idx] = { ...newItems[idx], video_url: e.target.value, url: e.target.value };
                          setForm({ ...form, items: newItems });
                        }}
                        placeholder="https://www.youtube.com/watch?v=... 또는 업로드된 URL"
                        size="small"
                      />
                    </Box>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                      disabled={uploading}
                      fullWidth
                      sx={{ mb: 1 }}
                    >
                      동영상 파일 업로드 (mp4, webm, mov)
                      <input
                        type="file"
                        hidden
                        accept="video/mp4,video/webm,video/quicktime,video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 500 * 1024 * 1024) {
                              showToast('파일 크기는 500MB 이하만 가능합니다.', 'error');
                              return;
                            }
                            handleFileUpload(idx, file, true);
                          }
                        }}
                      />
                    </Button>
                    <TextField
                      fullWidth
                      label="설명 (선택)"
                      value={item.alt || ''}
                      onChange={(e) => {
                        const newItems = [...form.items];
                        newItems[idx] = { ...newItems[idx], alt: e.target.value };
                        setForm({ ...form, items: newItems });
                      }}
                      size="small"
                    />
                    {(item.url || item.video_url) && !(item.url || '').includes('youtube') && !(item.url || '').includes('vimeo') && (
                      <Box sx={{ mt: 1.5, borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Box component="video" src={item.video_url || item.url}
                          sx={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                      </Box>
                    )}
                  </>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                      <TextField
                        fullWidth
                        label="이미지 URL"
                        value={item.url}
                        onChange={(e) => {
                          const newItems = [...form.items];
                          newItems[idx] = { ...newItems[idx], url: e.target.value };
                          setForm({ ...form, items: newItems });
                        }}
                        placeholder="https://..."
                        size="small"
                      />
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                        disabled={uploading}
                        sx={{ minWidth: 100, whiteSpace: 'nowrap' }}
                      >
                        업로드
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(idx, file, false);
                          }}
                        />
                      </Button>
                    </Box>
                    <TextField
                      fullWidth
                      label="대체 텍스트 (alt)"
                      value={item.alt || ''}
                      onChange={(e) => {
                        const newItems = [...form.items];
                        newItems[idx] = { ...newItems[idx], alt: e.target.value };
                        setForm({ ...form, items: newItems });
                      }}
                      size="small"
                    />
                    {item.url && (
                      <Box sx={{ mt: 1.5 }}>
                        <FocalPointPicker
                          imageUrl={item.url}
                          value={form.focal_points[idx] || { x: 50, y: 50 }}
                          onChange={(point) => {
                            const newFocals = [...form.focal_points];
                            newFocals[idx] = { ...newFocals[idx], ...point };
                            setForm({ ...form, focal_points: newFocals });
                          }}
                          scale={form.focal_points[idx]?.scale ?? 100}
                          onScaleChange={(s) => {
                            const newFocals = [...form.focal_points];
                            newFocals[idx] = { ...newFocals[idx], scale: s };
                            setForm({ ...form, focal_points: newFocals });
                          }}
                          layout={form.layout as '1col' | '2col' | '3col'}
                        />
                      </Box>
                    )}
                  </>
                )}
              </Card>
            ))}

            {/* Add video slot button */}
            {form.media_type === 'video' && form.items.length < 3 && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addVideoSlot}
                sx={{ borderStyle: 'dashed' }}
              >
                영상 추가 ({form.items.length}/3)
              </Button>
            )}

            <TextField
              label="정렬 순서"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              size="small"
              sx={{ maxWidth: 120 }}
            />

            <FormControlLabel
              control={<Switch checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />}
              label="활성화"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={uploading}>저장</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>미디어 삭제</DialogTitle>
        <DialogContent>
          <Typography>이 미디어를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
