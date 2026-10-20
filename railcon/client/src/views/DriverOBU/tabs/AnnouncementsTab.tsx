import { useState, useEffect } from 'react';
import { Volume2, MessageSquare, CheckCircle, Loader2 } from 'lucide-react';
import type { ActiveSession, CannedOption } from '../../../lib/types';
import { api } from '../../../lib/api';

interface AnnouncementsTabProps {
  session: ActiveSession;
}

const ANNOUNCEMENT_ICONS = [
  '🚪', '♿', '❄️', '🚫', '⏱️', '🏁', '🎫', '📦', '🔗', '🛑', '📍', '⚠️'
];

export function AnnouncementsTab({ session }: AnnouncementsTabProps) {
  const [cannedOptions, setCannedOptions] = useState<CannedOption[]>([]);
  const [sending, setSending] = useState(false);
  const [sentAnnouncement, setSentAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const { options } = await api.getCannedOptions();
        setCannedOptions(options.filter(o => o.category === 'PASSENGER_ANNOUNCEMENT'));
      } catch (err) {
        console.error('Failed to load announcements:', err);
      }
    };
    loadOptions();
  }, []);

  const sendAnnouncement = async (content: string) => {
    if (!session.clientId) return;
    
    setSending(true);
    try {
      await api.sendMessageWS({
        receiverClientId: session.clientId,
        content,
        type: 'STATUS',
      });
      setSentAnnouncement(content);
      setTimeout(() => setSentAnnouncement(null), 3000);
    } catch (err) {
      console.error('Failed to send announcement:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-rail-text mb-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-rail-gold" />
          Passenger Announcements (TTS)
        </h3>
        <p className="text-sm text-rail-textMuted mb-4">
          Triggers Text-to-Speech on Passenger Information Screens
        </p>
        <div className="grid grid-cols-3 gap-2">
          {cannedOptions.map((option, idx) => (
            <button
              key={option.id}
              onClick={() => sendAnnouncement(option.templateText)}
              disabled={sending}
              className="btn-secondary h-24 flex flex-col items-center justify-center gap-2 text-left p-3"
            >
              <span className="text-3xl">{ANNOUNCEMENT_ICONS[idx] || '📢'}</span>
              <span className="text-sm font-medium text-center leading-tight">{option.label}</span>
            </button>
          ))}
          {cannedOptions.length === 0 && (
            <div className="col-span-3 text-center py-8 text-rail-textMuted">Loading announcements...</div>
          )}
        </div>
      </div>

      {sentAnnouncement && (
        <div className="animate-in flex items-center gap-2 p-3 bg-rail-green/10 border border-rail-green/30 rounded-lg text-rail-green">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm">Announcement triggered: {sentAnnouncement.substring(0, 50)}...</span>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { Volume2, MessageSquare, CheckCircle, Loader2 } from 'lucide-react';
import type { ActiveSession, CannedOption } from '../../../lib/types';
import { api } from '../../../lib/api';

interface AnnouncementsTabProps {
  session: ActiveSession;
}

const ANNOUNCEMENT_ICONS = [
  '🚪', '♿', '❄️', '🚫', '⏱️', '🏁', '🎫', '📦', '🔗', '🛑', '📍', '⚠️'
];

export function AnnouncementsTab({ session }: AnnouncementsTabProps) {
  const [cannedOptions, setCannedOptions] = useState<CannedOption[]>([]);
  const [sending, setSending] = useState(false);
  const [sentAnnouncement, setSentAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const { options } = await api.getCannedOptions();
        setCannedOptions(options.filter(o => o.category === 'PASSENGER_ANNOUNCEMENT'));
      } catch (err) {
        console.error('Failed to load announcements:', err);
      }
    };
    loadOptions();
  }, []);

  const sendAnnouncement = async (content: string) => {
    if (!session.clientId) return;
    
    setSending(true);
    try {
      await api.sendMessageWS({
        receiverClientId: session.clientId,
        content,
        type: 'STATUS',
      });
      setSentAnnouncement(content);
      setTimeout(() => setSentAnnouncement(null), 3000);
    } catch (err) {
      console.error('Failed to send announcement:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-rail-text mb-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-rail-gold" />
          Passenger Announcements (TTS)
        </h3>
        <p className="text-sm text-rail-textMuted mb-4">
          Triggers Text-to-Speech on Passenger Information Screens
        </p>
        <div className="grid grid-cols-3 gap-2">
          {cannedOptions.map((option, idx) => (
            <button
              key={option.id}
              onClick={() => sendAnnouncement(option.templateText)}
              disabled={sending}
              className="btn-secondary h-24 flex flex-col items-center justify-center gap-2 text-left p-3"
            >
              <span className="text-3xl">{ANNOUNCEMENT_ICONS[idx] || '📢'}</span>
              <span className="text-sm font-medium text-center leading-tight">{option.label}</span>
            </button>
          ))}
          {cannedOptions.length === 0 && (
            <div className="col-span-3 text-center py-8 text-rail-textMuted">Loading announcements...</div>
          )}
        </div>
      </div>

      {sentAnnouncement && (
        <div className="animate-in flex items-center gap-2 p-3 bg-rail-green/10 border border-rail-green/30 rounded-lg text-rail-green">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm">Announcement triggered: {sentAnnouncement.substring(0, 50)}...</span>
        </div>
      )}
    </div>
  );
}
