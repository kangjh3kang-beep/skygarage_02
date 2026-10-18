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
export type RequestCategory = "residence" | "vehicle" | "visit" | "concierge";
export interface ServiceRequest {
  id: string;
  category: RequestCategory;
  subject: string;
  description: string;
  status: "submitted" | "reviewing" | "resolved" | "rejected";
  response: string | null;
  created_at: string;
}
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
  const [data, setData] = useState<Omit<State, "reload">>({
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
  useEffect(() => {
    let active = true;
    if (!userId) return;
    Promise.all([
      supabase
        .from("sgp_service_requests")
        .select("id,category,subject,description,status,response,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("platform_site_members")
        .select("site_id,unit_label,status,site:platform_sites(id,name,phase)")
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("platform_resident_vehicles")
        .select("id,plate,model,status")
        .eq("user_id", userId)
        .eq("status", "verified"),
    ])
      .then(([requests, memberships, vehicles]) => {
        if (!active) return;
        if (requests.error || memberships.error || vehicles.error) {
          setData((d) => ({ ...d, loading: false, error: true }));
          return;
        }
        setData({
          requests: requests.data as ServiceRequest[],
          memberships: memberships.data as unknown as SiteMembership[],
          vehicles: vehicles.data as ResidentVehicle[],
          loading: false,
          error: false,
        });
      })
      .catch(() => {
        if (active) setData((d) => ({ ...d, loading: false, error: true }));
      });
    return () => {
      active = false;
    };
  }, [userId, revision]);
  return (
    <Context.Provider value={{ ...data, reload }}>{children}</Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components -- Context and its consumer hook share one public API.
export function useResidentData() {
  const value = useContext(Context);
  if (!value) throw new Error("ResidentDataProvider is required");
  return value;
}
