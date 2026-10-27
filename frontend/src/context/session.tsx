import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  auth,
  clearSession,
  company as companyService,
  getOdooClient,
  loadSession,
  saveSession,
} from '@/lib/odoo';
import type { OdooClient, OdooUser } from '@/lib/odoo';
import type { CompanyInfo } from '@/lib/odoo/services/company';
import { safeCurrency } from '@/lib/format';

type Status = 'restoring' | 'anonymous' | 'authenticated';

interface LoginInput {
  login: string;
  password: string;
}

interface SessionValue {
  status: Status;
  user: OdooUser | null;
  company: CompanyInfo | null;
  currency: string;
  client: OdooClient;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getOdooClient(), []);
  const [status, setStatus] = useState<Status>('restoring');
  const [user, setUser] = useState<OdooUser | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  const loadCompany = useCallback(
    async (currentUser: OdooUser): Promise<CompanyInfo | null> => {
      try {
        const companyId = Array.isArray(currentUser.company_id) ? currentUser.company_id[0] : null;
        return await companyService.getCompanyInfo(client, companyId);
      } catch {
        return null;
      }
    },
    [client],
  );

  // Restauración de sesión (recarga de pestaña).
  useEffect(() => {
    let active = true;
    const stored = loadSession();

    if (!stored) {
      setStatus('anonymous');
      return;
    }

    (async () => {
      try {
        await client.login(stored.login, stored.password);
        const currentUser = await auth.getCurrentUser(client, client.uid ?? stored.uid);
        const info = await loadCompany(currentUser);
        if (!active) return;
        setUser(currentUser);
        setCompany(info);
        setStatus('authenticated');
      } catch {
        if (!active) return;
        clearSession();
        client.clearCredentials();
        setStatus('anonymous');
      }
    })();

    return () => {
      active = false;
    };
  }, [client, loadCompany]);

  const login = useCallback(
    async ({ login: username, password }: LoginInput) => {
      const result = await auth.authenticate(client, { login: username, password });
      const info = await loadCompany(result.user);

      saveSession({
        db: client.db,
        login: username,
        password,
        uid: result.uid,
        userName: result.user.name,
      });

      setUser(result.user);
      setCompany(info);
      setStatus('authenticated');
    },
    [client, loadCompany],
  );

  const logout = useCallback(() => {
    clearSession();
    client.clearCredentials();
    setUser(null);
    setCompany(null);
    setStatus('anonymous');
  }, [client]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      company,
      currency: safeCurrency(company?.currency),
      client,
      login,
      logout,
    }),
    [status, user, company, client, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return context;
}
