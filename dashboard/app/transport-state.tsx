'use client';

import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AppState } from '../../src/types';
import {
  cleanupExpiredLocksInState,
  createInitialState,
  loadStoredState,
  saveState,
} from '../../src/store/transportStore';

interface TransportStateContextValue {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
}

const TransportStateContext = createContext<TransportStateContextValue | null>(null);

export function TransportStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadStoredState());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveState(state);
  }, [ready, state]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((previous) => {
        const updated = structuredClone(previous);
        return cleanupExpiredLocksInState(updated) ? updated : previous;
      });
    }, 10000);
    return () => window.clearInterval(interval);
  }, []);

  if (!ready) {
    return <div className="p-8 text-sm text-slate-500">Loading operational workspace…</div>;
  }

  return (
    <TransportStateContext.Provider value={{ state, setState }}>
      {children}
    </TransportStateContext.Provider>
  );
}

export function useTransportState(): TransportStateContextValue {
  const context = useContext(TransportStateContext);
  if (!context) throw new Error('useTransportState must be used inside TransportStateProvider.');
  return context;
}
