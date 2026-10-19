import { Alert, Box, Button } from '@mui/material';
import { Link } from 'react-router-dom';
export default function RouteNotFound() {
  return <Box sx={{ p: 4 }}><Alert severity="info">요청한 페이지를 찾을 수 없습니다. 주소를 확인해 주세요.</Alert><Button component={Link} to="/">홈으로</Button><Button component={Link} to="/app">공식 앱으로</Button></Box>;
}
