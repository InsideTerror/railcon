import { useState, useEffect } from 'react';
import { Wifi, Satellite, HardDrive, Download, RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react';
import type { ActiveSession } from '../../../lib/types';
import { api } from '../../../lib/api';

interface SettingsTabProps {
  session: ActiveSession;
}

interface DiagnosticItem {
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'error';
  icon: React.ReactNode;
}

export function SettingsTab({ session }: SettingsTabProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const runDiagnostics = async () => {
      const items: DiagnosticItem[] = [
        {
          label: 'WebSocket Connection',
          value: 'Connected',
          status: 'ok',
          icon: <Wifi className="w-5 h-5 text-rail-green" />,
        },
        {
          label: 'GPS Signal',
          value: 'Strong (12 sats)',
          status: 'ok',
          icon: <Satellite className="w-5 h-5 text-rail-blue" />,
        },
        {
          label: 'GSM Signal',
          value: 'Good (-72 dBm)',
          status: 'ok',
          icon: <Wifi className="w-5 h-5 text-purple-400" />,
        },
        {
          label: 'Local Storage',
          value: '1.2 GB free',
          status: 'ok',
          icon: <HardDrive className="w-5 h-5 text-rail-textMuted" />,
        },
        {
          label: 'PIS Server',
          value: 'Running on :8080',
          status: 'ok',
          icon: <Info className="w-5 h-5 text-rail-blue" />,
        },
      ];
      setDiagnostics(items);
    };
    runDiagnostics();
  }, [session]);

  const handleSync = async () => {
    setSyncStatus('syncing');
    try {
      await api.getSession(session.clientId);
      setSyncStatus('synced');
      setLastSync(new Date());
    } catch {
      setSyncStatus('error');
    }
  };

  const getStatusIcon = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-5 h-5 text-rail-green" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-rail-yellow" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-rail-red" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-rail-text flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-rail-gold" />
            Diagnostics
          </h3>
          <button onClick={handleSync} disabled={syncStatus === 'syncing'} className="btn-secondary">
            {syncStatus === 'syncing' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span className="ml-1">Sync</span>
              </>
            )}
          </button>
        </div>

        <div className="space-y-3">
          {diagnostics.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-rail-bg rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-rail-border flex items-center justify-center">
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-rail-text">{item.label}</div>
                <div className="text-sm text-rail-textMuted font-mono">{item.value}</div>
              </div>
              {getStatusIcon(item.status)}
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-rail-border flex items-center justify-between text-sm">
          <span className="text-rail-textMuted">Last sync</span>
          <span className="font-mono text-rail-text">
            {lastSync ? lastSync.toLocaleTimeString() : 'Never'}
          </span>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-rail-text mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-rail-gold" />
          Data Management
        </h3>
        <div className="space-y-3">
          <button className="btn-secondary w-full justify-start">
            <Download className="w-4 h-4" />
            <span>Export Session Log</span>
          </button>
          <button className="btn-secondary w-full justify-start">
            <Download className="w-4 h-4" />
            <span>Export Message History</span>
          </button>
          <button className="btn-ghost w-full justify-start text-rail-red hover:bg-rail-red/10">
            <AlertCircle className="w-4 h-4" />
            <span>Clear Local Cache</span>
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-rail-text mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-rail-gold" />
          Device Info
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-rail-textMuted">Client ID</span>
            <span className="font-mono text-rail-text">{session.clientId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-rail-textMuted">App Version</span>
            <span className="font-mono text-rail-text">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-rail-textMuted">Platform</span>
            <span className="font-mono text-rail-text">{navigator.platform}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-rail-textMuted">User Agent</span>
            <span className="font-mono text-rail-text truncate max-w-[200px]">{navigator.userAgent.substring(0, 30)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
