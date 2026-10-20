import { useState, useEffect } from 'react';
import { Plus, LogOut, Fuel, TrendingUp, Calendar, ChevronDown } from 'lucide-react';
import type { ActiveSession } from '../../../lib/types';
import { api } from '../../../lib/api';
import { formatTime } from '../../../lib/utils';

interface DutyActivityTabProps {
  session: ActiveSession;
}

export function DutyActivityTab({ session }: DutyActivityTabProps) {
  const [timetables, setTimetables] = useState<any[]>([]);
  const [selectedTimetable, setSelectedTimetable] = useState<string | null>(session.timetableId || null);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [fuelData, setFuelData] = useState({ fuel: '', mileage: '' });

  useEffect(() => {
    const loadTimetables = async () => {
      try {
        const { timetables } = await api.getTimetables();
        setTimetables(timetables);
      } catch (err) {
        console.error('Failed to load timetables:', err);
      }
    };
    loadTimetables();
  }, []);

  const handleRunSelect = async (timetableId: string) => {
    try {
      await api.updateSession(session.clientId, { timetableId, currentStopIndex: 0, delayMinutes: 0, status: 'ACTIVE' });
      setSelectedTimetable(timetableId);
    } catch (err) {
      console.error('Failed to select run:', err);
    }
  };

  const handleFuelSubmit = async () => {
    // TODO: Implement fuel/mileage entry
    setShowFuelModal(false);
    setFuelData({ fuel: '', mileage: '' });
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-rail-text">Current Run</h3>
          {session.timetableId && (
            <span className="badge-green">Active</span>
          )}
        </div>

        {session.timetable ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-rail-bg rounded-lg">
              <div>
                <div className="text-xs text-rail-textDim uppercase tracking-wide">Route</div>
                <div className="font-mono text-lg font-semibold text-rail-text">{session.timetable.route?.id}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-rail-textDim uppercase tracking-wide">Run</div>
                <div className="font-mono text-lg font-semibold text-rail-gold">{session.timetable.runNumber}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-rail-bg rounded-lg">
                <div className="text-xs text-rail-textDim uppercase tracking-wide">Start</div>
                <div className="font-mono text-lg text-rail-text">{formatTime(session.timetable.startTime)}</div>
              </div>
              <div className="p-3 bg-rail-bg rounded-lg">
                <div className="text-xs text-rail-textDim uppercase tracking-wide">End</div>
                <div className="font-mono text-lg text-rail-text">{formatTime(session.timetable.endTime)}</div>
              </div>
              <div className="p-3 bg-rail-bg rounded-lg">
                <div className="text-xs text-rail-textDim uppercase tracking-wide">Direction</div>
                <div className="font-mono text-lg text-rail-text">{session.timetable.direction === 1 ? 'Outbound' : 'Inbound'}</div>
              </div>
              <div className="p-3 bg-rail-bg rounded-lg">
                <div className="text-xs text-rail-textDim uppercase tracking-wide">Stops</div>
                <div className="font-mono text-lg text-rail-text">{session.timetable.stops?.length || 0}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-rail-textMuted">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No run selected</p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-rail-text mb-4">Select Run</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {timetables.map((tt) => (
            <button
              key={tt.id}
              onClick={() => handleRunSelect(tt.id)}
              disabled={selectedTimetable === tt.id}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedTimetable === tt.id
                  ? 'border-rail-gold bg-rail-gold/5'
                  : 'border-rail-border hover:border-rail-gold/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-rail-text">{tt.route?.id} - {tt.runNumber}</div>
                  <div className="text-sm text-rail-textMuted">{tt.route?.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-rail-gold">{formatTime(tt.startTime)}</div>
                  <div className="text-xs text-rail-textDim">{tt.stops?.length} stops</div>
                </div>
              </div>
            </button>
          ))}
          {timetables.length === 0 && (
            <div className="text-center py-8 text-rail-textMuted">No timetables available</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowFuelModal(true)}
          className="btn-secondary flex flex-col items-center gap-2 p-4"
        >
          <Fuel className="w-6 h-6" />
          <span className="text-sm font-medium">Fuel Entry</span>
        </button>
        <button className="btn-secondary flex flex-col items-center gap-2 p-4">
          <TrendingUp className="w-6 h-6" />
          <span className="text-sm font-medium">Mileage</span>
        </button>
      </div>

      {showFuelModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in">
          <div className="panel w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Fuel & Mileage Entry</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-rail-textMuted mb-1">Fuel (liters)</label>
                <input
                  type="number"
                  value={fuelData.fuel}
                  onChange={(e) => setFuelData({ ...fuelData, fuel: e.target.value })}
                  className="input"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm text-rail-textMuted mb-1">Mileage (km)</label>
                <input
                  type="number"
                  value={fuelData.mileage}
                  onChange={(e) => setFuelData({ ...fuelData, mileage: e.target.value })}
                  className="input"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowFuelModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleFuelSubmit} className="btn-primary flex-1">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
