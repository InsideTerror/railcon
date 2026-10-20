import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Train, MapPin, AlertTriangle, Volume2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { ActiveSession } from '../../lib/types';
import { formatTime } from '../../lib/utils';

export function PassengerPIS() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [time, setTime] = useState(new Date());
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!clientId) return;

    const fetchData = async () => {
      try {
        const { session: data } = await api.getSession(clientId);
        setSession(data);
      } catch (err) {
        console.error('Failed to fetch PIS data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [clientId]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const announceNextStop = () => {
    if (!session?.timetable?.stops) return;
    const nextStop = session.timetable.stops[session.currentStopIndex + 1];
    if (nextStop) {
      speak(`Next station: ${nextStop.station?.name}.`);
    }
  };

  const announceDoorsClosing = () => {
    speak('Caution, doors are closing.');
  };

  const announceTerminal = () => {
    speak('This is the final stop. All passengers must alight.');
  };

  if (!clientId) {
    return (
      <div className="h-screen flex items-center justify-center bg-rail-bg text-rail-textMuted">
        <div className="text-center">
          <Train className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>No client ID specified</p>
          <p className="text-sm mt-2">Use ?clientId=OBU-001</p>
        </div>
      </div>
    );
  }

  if (!session?.timetable) {
    return (
      <div className="h-screen flex items-center justify-center bg-rail-bg text-rail-textMuted">
        <div className="text-center">
          <Train className="w-16 h-16 mx-auto mb-4 opacity-30 animate-spin" />
          <p>Loading timetable...</p>
        </div>
      </div>
    );
  }

  const stops = session.timetable.stops;
  const currentStop = stops[session.currentStopIndex];
  const nextStop = stops[session.currentStopIndex + 1];

  return (
    <div className="h-screen bg-rail-bg text-white overflow-hidden">
      <div className="h-full grid grid-cols-[1fr_2fr]">
        <div className="bg-rail-panel border-r border-rail-border p-6 flex flex-col">
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-rail-gold">{session.timetable.route?.id || '—'}</div>
            <div className="text-2xl text-rail-textMuted mt-2">{session.timetable.route?.name || '—'}</div>
            <div className="text-sm text-rail-textDim mt-1">Run {session.timetable.runNumber} • {session.timetable.direction === 1 ? 'Outbound' : 'Inbound'}</div>
          </div>

          <div className="bg-rail-bg border-2 border-rail-gold/30 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 text-rail-gold mb-2">
              <MapPin className="w-5 h-5" />
              <span className="text-sm uppercase tracking-wide">Next Stop</span>
            </div>
            <div className="text-4xl font-semibold text-white">{nextStop?.station?.name || 'Terminal'}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-rail-bg rounded-lg p-4 text-center">
              <div className="text-xs text-rail-textDim uppercase tracking-wide">Arrival</div>
              <div className="text-2xl font-mono font-bold text-rail-gold">{currentStop?.scheduledArrival ? formatTime(currentStop.scheduledArrival) : '--:--'}</div>
            </div>
            <div className="bg-rail-bg rounded-lg p-4 text-center">
              <div className="text-xs text-rail-textDim uppercase tracking-wide">Departure</div>
              <div className="text-2xl font-mono font-bold text-rail-gold">{currentStop?.scheduledDeparture ? formatTime(currentStop.scheduledDeparture) : '--:--'}</div>
            </div>
          </div>

          {session.delayMinutes > 0 && (
            <div className="bg-rail-yellow/10 border border-rail-yellow/30 rounded-lg p-3 mb-6 text-center">
              <AlertTriangle className="w-5 h-5 text-rail-yellow mx-auto mb-1" />
              <div className="text-rail-yellow font-semibold">DELAY: +{session.delayMinutes} minutes</div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <ul className="space-y-1">
              {stops.map((stop, idx) => {
                const status = idx < session.currentStopIndex ? 'completed' : idx === session.currentStopIndex ? 'current' : idx === session.currentStopIndex + 1 ? 'next' : 'upcoming';
                return (
                  <li
                    key={stop.id}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      status === 'current' ? 'bg-rail-gold/10 border border-rail-gold/30' :
                      status === 'next' ? 'bg-rail-blue/10 border border-rail-blue/30' :
                      status === 'completed' ? 'opacity-40' : 'hover:bg-rail-border'
                    }`}
                  >
                    <span className="w-8 text-center font-mono text-lg font-bold text-rail-gold">{idx + 1}</span>
                    <span className="flex-1 text-lg">{stop.station?.name}</span>
                    <span className="font-mono text-rail-textMuted">{stop.scheduledDeparture ? formatTime(stop.scheduledDeparture) : '--:--'}</span>
                    {session.delayMinutes > 0 && idx >= session.currentStopIndex && (
                      <span className="badge-yellow">+{session.delayMinutes}'</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="bg-rail-bg p-6 flex flex-col">
          <div className="text-center mb-8">
            <div className="text-7xl font-light tabular-nums text-rail-gold font-mono">
              {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div className="text-rail-textMuted mt-2">{time.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="grid grid-cols-3 gap-4 max-w-2xl w-full">
              <button onClick={announceNextStop} disabled={speaking || !nextStop} className="btn-primary h-20 flex flex-col items-center gap-2">
                <MapPin className="w-8 h-8" />
                <span className="text-sm">Next Stop</span>
                <span className="text-xs text-rail-textDim">{nextStop?.station?.name || 'N/A'}</span>
              </button>
              <button onClick={announceDoorsClosing} disabled={speaking} className={`btn-danger h-20 flex flex-col items-center gap-2 ${speaking ? 'ring-4 ring-rail-red/50 animate-pulse' : ''}`}>
                <AlertTriangle className="w-8 h-8" />
                <span className="text-sm">Doors Closing</span>
                <span className="text-xs">TTS Trigger</span>
              </button>
              <button onClick={announceTerminal} disabled={speaking || nextStop} className="btn-secondary h-20 flex flex-col items-center gap-2">
                <Train className="w-8 h-8" />
                <span className="text-sm">Terminal</span>
                <span className="text-xs">All Alight</span>
              </button>
            </div>
          </div>

          {speaking && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 animate-in bg-rail-green text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
              <Volume2 className="w-5 h-5 animate-pulse" />
              <span>Speaking announcement...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
