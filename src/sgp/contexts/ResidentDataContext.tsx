import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { useSgpAuth } from "./SgpAuthContext";
import { parseMyRequests,type ServiceRequest } from '../../lib/service-requests';
export type { RequestCategory,ServiceRequest } from '../../lib/service-requests';
export interface SiteMembership {
  site_id: string;
  unit_label: string;
  status: string;
  site: { id: string; name: string; phase: string } | null;
}
export interface ResidentVehicle {
  id: string;
  plate: string;
  model: string;
  status: string;
}
interface State {
  requests: ServiceRequest[];
  memberships: SiteMembership[];
  vehicles: ResidentVehicle[];
  loading: boolean;
  error: boolean;
  reload: () => void;
}
const Context = createContext<State | null>(null);
export function ResidentDataProvider({ children }: { children: ReactNode }) {
  const { user } = useSgpAuth();
  const userId = user?.id;
  const [data, setData] = useState<Omit<State, "reload"> & {key?:string}>({
    requests: [],
    memberships: [],
    vehicles: [],
    loading: true,
    error: false,
  });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    setData({
      requests: [],
      memberships: [],
      vehicles: [],
      loading: true,
      error: false,
    });
    setRevision((n) => n + 1);
  }, []);
  const requestKey=`${userId}:${revision}`;
  useEffect(() => {
    let active = true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    if (!userId){clearTimeout(timeout);return;}
    Promise.all([
      supabase.rpc('platform_my_service_requests').abortSignal(controller.signal),
      supabase
        .from("platform_site_members")
        .select("site_id,unit_label,status,site:platform_sites(id,name,phase)")
        .eq("user_id", userId)
        .eq("status", "active").abortSignal(controller.signal),
      supabase
        .from("platform_resident_vehicles")
        .select("id,plate,model,status")
        .eq("user_id", userId)
        .eq("status", "verified").abortSignal(controller.signal),
    ])
      .then(([requests, memberships, vehicles]) => {
        if (!active) return;
        if (requests.error || memberships.error || vehicles.error || !Array.isArray(memberships.data) || !Array.isArray(vehicles.data)) {
          setData({key:requestKey,requests:[],memberships:[],vehicles:[],loading:false,error:true});
          return;
        }
        setData({
          key:requestKey,requests:parseMyRequests(requests.data),
          memberships: memberships.data as unknown as SiteMembership[],
          vehicles: vehicles.data as ResidentVehicle[],
          loading: false,
          error: false,
        });
      })
      .catch(() => {
        if (active) setData({key:requestKey,requests:[],memberships:[],vehicles:[],loading:false,error:true});
      }).finally(()=>clearTimeout(timeout));
    return () => {active=false;clearTimeout(timeout);controller.abort();};
  }, [userId, requestKey]);
  const current=data.key===requestKey?data:{requests:[],memberships:[],vehicles:[],loading:!!userId,error:false};
  return (
    <Context.Provider value={{ ...current, reload }}>{children}</Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components -- Context and its consumer hook share one public API.
export function useResidentData() {
  const value = useContext(Context);
  if (!value) throw new Error("ResidentDataProvider is required");
  return value;
}
