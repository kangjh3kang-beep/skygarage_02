import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import {
  trustedAdminRole,
  adminLoginIdentifier,
  type AdminRole,
} from "../../lib/admin-role";
export type UserRole = AdminRole;
interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  displayName: string;
  loading: boolean;
  isSuperAdmin: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const sync = async (next: User | null) => {
      const version = ++generation;
      setUser(next);
      setRole(null);
      setDisplayName("");
      setLoading(!!next);
      if (!next) return;
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role,display_name")
          .eq("user_id", next.id)
          .maybeSingle();
        if (active && generation === version) {
          setRole(trustedAdminRole(data, error));
          setDisplayName(!error ? data?.display_name || "" : "");
        }
      } catch {
        if (active && generation === version) {
          setRole(null);
          setDisplayName("");
        }
      } finally {
        if (active && generation === version) setLoading(false);
      }
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) void sync(data.session?.user || null);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (active) void sync(session?.user || null);
      }, 0);
    });
    return () => {
      active = false;
      ++generation;
      data.subscription.unsubscribe();
    };
  }, []);
  async function signIn(identifier: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: adminLoginIdentifier(identifier),
      password,
    });
    return { error: error?.message || null };
  }
  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setDisplayName("");
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        displayName,
        loading,
        isSuperAdmin: role === "super_admin",
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
