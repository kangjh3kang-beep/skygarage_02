import { Component, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, p: 3 }}>
          <Card sx={{ maxWidth: 480, width: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <ErrorOutlineIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
              <Typography variant="h3" sx={{ mb: 1 }}>오류가 발생했습니다</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                페이지를 불러오는 중 문제가 발생했습니다. 새로고침을 시도하거나 관리자에게 문의하세요.
              </Typography>
              {this.state.error && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontFamily: 'monospace', bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                  {this.state.error.message}
                </Typography>
              )}
              <Button variant="contained" startIcon={<RefreshIcon />} onClick={this.handleReset}>
                다시 시도
              </Button>
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}
