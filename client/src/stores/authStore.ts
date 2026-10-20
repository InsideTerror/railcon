import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../lib/types';
import { api } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (pin: string, forteId: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (pin: string, forteId: string) => {
        const response = await api.login({ pin, forteId });
        api.setToken(response.token);
        const user: User = {
          id: response.user.id,
          forteId: response.user.forteId,
          name: response.user.name,
          role: response.user.role as User['role'],
          createdAt: new Date().toISOString(),
        };
        set({ user, token: response.token, isAuthenticated: true });
      },

      logout: () => {
        api.setToken(null);
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      hydrate: async () => {
        const token = get().token;
        if (token) {
          api.setToken(token);
          try {
            const { user } = await api.getMe();
            set({
              user: {
                id: user.id,
                forteId: user.forteId,
                name: user.name,
                role: user.role as User['role'],
                createdAt: new Date().toISOString(),
              },
              isAuthenticated: true,
            });
          } catch {
            get().logout();
          }
        }
      },
    }),
    {
      name: 'railcon-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
