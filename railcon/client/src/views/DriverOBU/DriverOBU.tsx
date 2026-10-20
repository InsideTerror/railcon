import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './components/Header';
import { StopSequencePanel } from './components/StopSequencePanel';
import { NavigationTabs } from './components/NavigationTabs';
import { BottomActionStrip } from './components/BottomActionStrip';
import { LogoutModal } from './modals/LogoutModal';
import { useSessionStore } from '../../stores/sessionStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import type { ActiveSession } from '../../lib/types';

export function DriverOBU() {
  const { user } = useAuthStore();
  const { session, setSession, registerClient, clientId } = useSessionStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutType, setLogoutType] = useState<'driver' | 'route' | 'both'>('driver');
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      if (!clientId) return;
      
      try {
        await api.connectWebSocket(clientId);
        setWsConnected(true);
        
        const { session: registeredSession } = await api.registerClient({
          clientId,
          driverId: user?.id,
        });
        setSession(registeredSession);
      } catch (err) {
        console.error('Failed to initialize session:', err);
      }
    };

    initSession();

    const unsubSession = api.onWSMessage<ActiveSession>('session-updated', (data) => {
      setSession(data);
    });

    const unsubStop = api.onWSMessage<{ stopIndex: number }>('stop-advanced', (data) => {
      setSession((prev) => prev ? { ...prev, currentStopIndex: data.stopIndex } : null);
    });

    const unsubDoor = api.onWSMessage<{ doorOpen: boolean }>('door-state-changed', (data) => {
      setSession((prev) => prev ? { ...prev, doorOpen: data.doorOpen } : null);
    });

    const unsubSchedule = api.onWSMessage<{ delayMinutes: number }>('schedule-override', (data) => {
      setSession((prev) => prev ? { ...prev, delayMinutes: data.delayMinutes } : null);
    });

    const unsubTruncate = api.onWSMessage<{ newStopIndex: number }>('stops-truncated', (data) => {
      setSession((prev) => prev ? { ...prev, currentStopIndex: data.newStopIndex } : null);
    });

    const unsubTerminate = api.onWSMessage<{ clientId: string }>('session-terminated', (data) => {
      if (data.clientId === clientId) {
        setSession((prev) => prev ? { ...prev, status: 'NON_ACTIVE', driverId: null, timetableId: null, currentStopIndex: 0, delayMinutes: 0 } : null);
      }
    });

    return () => {
      unsubSession();
      unsubStop();
      unsubDoor();
      unsubSchedule();
      unsubTruncate();
      unsubTerminate();
      api.disconnectWebSocket();
    };
  }, [clientId, user?.id, setSession]);

  const handleLogout = async (type: 'driver' | 'route' | 'both') => {
    if (!session) return;
    
    try {
      if (type === 'driver' || type === 'both') {
        await api.updateSession(session.clientId, { driverId: null, status: 'IDLE' });
      }
      if (type === 'route' || type === 'both') {
        await api.updateSession(session.clientId, { timetableId: null, currentStopIndex: 0, delayMinutes: 0 });
      }
      setShowLogoutModal(false);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center bg-rail-bg">
        <div className="text-center text-rail-textMuted">Initializing OBU...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-rail-bg">
      <Header 
        session={session} 
        wsConnected={wsConnected}
        onLogoutClick={() => setShowLogoutModal(true)}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <StopSequencePanel session={session} />
        <NavigationTabs session={session} />
      </div>
      
      <BottomActionStrip session={session} />
      
      {showLogoutModal && (
        <LogoutModal
          onClose={() => setShowLogoutModal(false)}
          onConfirm={(type) => handleLogout(type)}
          session={session}
        />
      )}
    </div>
  );
}
