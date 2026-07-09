import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useDomainPermission } from './useDomainPermission';
import { useAuth } from '../admin/contexts/AuthContext';
import { requiresStepUp, isStepUpValid, type StepUpReason } from '../admin/services/stepUpAuth';

export interface RouteGuardState {
  allowed: boolean;
  needsStepUp: boolean;
  stepUpReason: StepUpReason | null;
  loading: boolean;
}

export function useRouteGuard(): RouteGuardState {
  const { pathname } = useLocation();
  const { canAccessRoute } = useDomainPermission();
  const { user } = useAuth();
  const [state, setState] = useState<RouteGuardState>({
    allowed: true,
    needsStepUp: false,
    stepUpReason: null,
    loading: true,
  });

  const evaluate = useCallback(() => {
    if (!user) {
      setState({ allowed: false, needsStepUp: false, stepUpReason: null, loading: false });
      return;
    }

    const rbacAllowed = canAccessRoute(pathname);
    if (!rbacAllowed) {
      setState({ allowed: false, needsStepUp: false, stepUpReason: null, loading: false });
      return;
    }

    const stepUpReason = requiresStepUp(pathname);
    if (stepUpReason) {
      const valid = isStepUpValid(user.id, stepUpReason);
      setState({ allowed: valid, needsStepUp: !valid, stepUpReason, loading: false });
      return;
    }

    setState({ allowed: true, needsStepUp: false, stepUpReason: null, loading: false });
  }, [pathname, canAccessRoute, user]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  return state;
}
