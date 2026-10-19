import type { ReactNode } from 'react';
import { Alert, Box, Button, Stack } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { isAdminPageAvailable } from '../../lib/route-access';

export default function AdminPageGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  if (isAdminPageAvailable(pathname)) return children;
  return <Box sx={{ py: 4 }}>
    <Alert severity="info">이 운영 모듈은 현장별 권한·데이터 연결과 인수를 준비 중입니다. 현재는 실행할 수 없습니다.</Alert>
    <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
      <Button component={Link} to="/admin">통합 운영</Button>
      <Button component={Link} to="/admin/validation">페이지·연동 검증</Button>
      <Button component={Link} to="/admin/governance">현장 검증·개선</Button>
    </Stack>
  </Box>;
}
