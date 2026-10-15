import { createContext, useContext } from 'react';
import type { Me } from './api';

export interface MeCtx {
  me: Me;
  /** Da formato de dinero con la moneda del negocio. */
  money: (n: number) => string;
}

export const MeContext = createContext<MeCtx | null>(null);

export function useMe(): MeCtx {
  const v = useContext(MeContext);
  if (!v) throw new Error('useMe debe usarse dentro de <Shell>');
  return v;
}