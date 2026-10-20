import { X, LogOut, Route, User, AlertTriangle } from 'lucide-react';
import type { ActiveSession } from '../../../lib/types';

interface LogoutModalProps {
  onClose: () => void;
  onConfirm: (type: 'driver' | 'route' | 'both') => void;
  session: ActiveSession;
}

export function LogoutModal({ onClose, onConfirm, session }: LogoutModalProps) {
  const options = [
    {
      type: 'driver' as const,
      icon: User,
      title: 'Log Out Driver',
      description: 'End driver session, keep route active',
      warning: session.driver ? null : 'No driver currently logged in',
    },
    {
      type: 'route' as const,
      icon: Route,
      title: 'Clear Route',
      description: 'Keep driver logged in, clear timetable',
      warning: session.timetable ? null : 'No route currently active',
    },
    {
      type: 'both' as const,
      icon: LogOut,
      title: 'Full Logout',
      description: 'End driver session and clear route',
      warning: null,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in">
      <div className="panel w-full max-w-md">
        <div className="panel-header">
          <h2 className="panel-title">Logout Options</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {options.map((option) => (
            <button
              key={option.type}
              onClick={() => onConfirm(option.type)}
              disabled={!!option.warning}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-150 flex items-start gap-3 ${
                option.warning
                  ? 'border-rail-border bg-rail-bg opacity-50 cursor-not-allowed'
                  : 'border-rail-border hover:border-rail-gold/50 hover:bg-rail-gold/5'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-rail-gold/10 flex items-center justify-center flex-shrink-0">
                <option.icon className="w-5 h-5 text-rail-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-rail-text">{option.title}</div>
                <div className="text-sm text-rail-textMuted mt-0.5">{option.description}</div>
                {option.warning && (
                  <div className="text-xs text-rail-yellow mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {option.warning}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <button onClick={onClose} className="btn-secondary w-full mx-4 mb-4">
          Cancel
        </button>
      </div>
    </div>
  );
}
