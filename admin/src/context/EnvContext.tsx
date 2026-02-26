import { createContext, useContext, useState, ReactNode } from 'react';

export type Env = 'dev' | 'prod';

export const PROD_API_URL = 'https://wpwpawhz29.ap-southeast-1.awsapprunner.com';

const PROD_TOKEN_KEY = 'nora_admin_token_prod';

interface EnvContextType {
  env: Env;
  prodToken: string | null;
  setEnv: (env: Env) => void;
  setProdToken: (token: string) => void;
  clearProdToken: () => void;
}

const EnvContext = createContext<EnvContextType | null>(null);

export function EnvProvider({ children }: { children: ReactNode }) {
  const [env, setEnvState] = useState<Env>('dev');
  const [prodToken, setProdTokenState] = useState<string | null>(
    () => localStorage.getItem(PROD_TOKEN_KEY)
  );

  const setEnv = (e: Env) => setEnvState(e);

  const setProdToken = (token: string) => {
    localStorage.setItem(PROD_TOKEN_KEY, token);
    setProdTokenState(token);
  };

  const clearProdToken = () => {
    localStorage.removeItem(PROD_TOKEN_KEY);
    setProdTokenState(null);
  };

  return (
    <EnvContext.Provider value={{ env, prodToken, setEnv, setProdToken, clearProdToken }}>
      {children}
    </EnvContext.Provider>
  );
}

export function useEnv() {
  const ctx = useContext(EnvContext);
  if (!ctx) throw new Error('useEnv must be used inside EnvProvider');
  return ctx;
}
