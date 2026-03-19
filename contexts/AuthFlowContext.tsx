import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthFlowData {
  phone: string;
  full_name: string;
  pin: string;
  role: string;
  email: string;
}

interface AuthFlowContextType {
  flowData: AuthFlowData | null;
  setFlowData: (data: AuthFlowData) => void;
  clearFlowData: () => void;
}

const AuthFlowContext = createContext<AuthFlowContextType | null>(null);

export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [flowData, setFlowDataState] = useState<AuthFlowData | null>(null);

  const setFlowData = (data: AuthFlowData) => setFlowDataState(data);
  const clearFlowData = () => setFlowDataState(null);

  return (
    <AuthFlowContext.Provider value={{ flowData, setFlowData, clearFlowData }}>
      {children}
    </AuthFlowContext.Provider>
  );
}

export function useAuthFlow() {
  const ctx = useContext(AuthFlowContext);
  if (!ctx) throw new Error('useAuthFlow must be used within AuthFlowProvider');
  return ctx;
}
