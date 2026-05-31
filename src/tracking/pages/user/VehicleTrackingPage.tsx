import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import { ValetVehicleDetail } from '../../components/Valet';

export default function VehicleTrackingPage() {
  const navigate = useNavigate();
  const { vehicleId } = useParams<{ vehicleId: string }>();

  if (!vehicleId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">차량 ID가 지정되지 않았습니다.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={() => navigate('/tracking')}>대시보드</Link>
        <Typography color="text.primary" variant="body2">차량 추적</Typography>
      </Breadcrumbs>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>차량 상태 추적</Typography>
      <ValetVehicleDetail vehicleId={vehicleId} />
    </Box>
  );
}
