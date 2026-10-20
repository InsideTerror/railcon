import { useState, useEffect } from 'react';
import { FleetTable } from './components/FleetTable';
import { DispatcherControls } from './components/DispatcherControls';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import type { FleetData } from '../../lib/types';
import { Radio } from 'lucide-react';

export function DispatcherDashboard() {
  const { user } = useAuthStore();
  const [fleet, setFleet] = useState<FleetData>({ active: [], idle: [], nonActive: [], total: 0 });
  const [activeTab, setActiveTab] = useState<'active' | 'idle' | 'nonActive'>('active');

  useEffect(() => {
    const loadFleet = async () => {
      try {
        const data = await api.getFleet();
        setFleet(data);
      } catch (err) {
        console.error('Failed to load fleet:', err);
      }
    };
    loadFleet();

    const unsub = api.onWSMessage<any>('fleet-update', (data) => {
      loadFleet();
    });

    return () => unsub();
  }, []);

  const sessions = fleet[activeTab] || [];

  return (
    <div className="h-full flex flex-col bg-rail-bg">
      <header className="h-16 bg-rail-panel border-b border-rail-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rail-gold/10 flex items-center justify-center">
            <Radio className="w-5 h-5 text-rail-gold" />
          </div>
          <div>
            <div className="text-xs text-rail-textDim uppercase tracking-wide">Dispatcher</div>
            <div className="font-mono text-lg font-semibold text-rail-text">{user?.forteId}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-rail-textMuted">Fleet: {fleet.total}</span>
          <span className="badge-green">{fleet.active.length} Active</span>
          <span className="badge-yellow">{fleet.idle.length} Idle</span>
          <span className="badge-red">{fleet.nonActive.length} Non-Active</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[70%] border-r border-rail-border flex flex-col">
          <div className="flex border-b border-rail-border bg-rail-panel shrink-0">
            {(['active', 'idle', 'nonActive'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-btn px-6 ${activeTab === tab ? 'tab-btn-active' : ''}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="badge-gold text-xs">
                  {fleet[tab]?.length || 0}
                </span>
              </button>
            ))}
          </div>

          <FleetTable sessions={sessions} activeTab={activeTab} />
        </div>

        <DispatcherControls fleet={fleet} />
      </div>
    </div>
  );
}
