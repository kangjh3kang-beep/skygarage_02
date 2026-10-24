import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import SupportTickets from './SupportTickets';
export default function PlatformReadiness(){return <Box sx={{maxWidth:1200,mx:'auto'}}>
 <Typography component="h1" variant="h4">플랫폼 운영 준비</Typography>
 <Stack direction="row" spacing={1} useFlexGap sx={{my:2,flexWrap:'wrap'}}><Button component={Link} to="/admin/start">처음 설정·검수 시작하기</Button><Button component={Link} to="/admin/implementation">통합시스템 구축·검증 현황</Button><Button component={Link} to="/admin/complexes">단지·현장 운영 관리</Button></Stack>
 <Alert severity="info" sx={{mb:3}}>회원 요청을 담당자에게 배정하고 답변할 수 있습니다. 실제 장비 운행·출입·결제 개시는 별도의 연동과 검수가 필요합니다.</Alert>
 <SupportTickets embedded/>
</Box>;}
