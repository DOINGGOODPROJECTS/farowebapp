"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  chatCredits: number;
  plan: 'free' | 'pro' | 'max';
  planRenewsAt: string | null;
};

const AuthContext = createContext<AuthUser | null>(null);

export const useAuthUser = () => useContext(AuthContext);

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const allowGuest =
    pathname?.startsWith("/chat") || pathname?.startsWith("/comparison");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Unauthorized");
        }
        const payload = await response.json();
        if (active) {
          setUser(payload.user as AuthUser);
        }
      } catch {
        if (active) {
          setUser(null);
          if (!allowGuest) {
            router.replace("/login");
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [allowGuest, router]);

  if (loading) {
    return null;
  }

  if (!user && !allowGuest) {
    return null;
  }

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
