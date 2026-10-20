import { create } from 'zustand';
import type { ActiveSession } from '../lib/types';

interface SessionState {
  session: ActiveSession | null;
  clientId: string;
  setSession: (session: ActiveSession | null) => void;
  registerClient: (clientId: string, driverId?: string | null, timetableId?: string | null) => void;
  updateSession: (updates: Partial<ActiveSession>) => void;
  advanceStop: () => void;
  setDelay: (minutes: number) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  clientId: 'OBU-001', // In production, this would come from device registration

  setSession: (session) => set({ session }),

  registerClient: (clientId, driverId, timetableId) => {
    set((state) => ({
      clientId,
      session: state.session ? { ...state.session, clientId, driverId: driverId ?? null, timetableId: timetableId ?? null } : null,
    }));
  },

  updateSession: (updates) => {
    set((state) => ({
      session: state.session ? { ...state.session, ...updates } : null,
    }));
  },

  advanceStop: () => {
    set((state) => ({
      session: state.session
        ? { ...state.session, currentStopIndex: state.session.currentStopIndex + 1 }
        : null,
    }));
  },

  setDelay: (minutes) => {
    set((state) => ({
      session: state.session ? { ...state.session, delayMinutes: minutes } : null,
    }));
  },
}));
