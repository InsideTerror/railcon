import { useState, useEffect } from 'react';
import { Send, MessageSquare, CheckCircle, Loader2 } from 'lucide-react';
import type { ActiveSession, CannedOption } from '../../../lib/types';
import { api } from '../../../lib/api';

interface SendMessageTabProps {
  session: ActiveSession;
}

const MESSAGE_GROUPS = [
  { title: 'Operational', icons: ['🚨', '🔧', '📞', '👥', '🚦', '🚧', '🏥', '🚪', '⚠️', '👥', '🌧️', '👮'] },
  { title: 'Service', icons: ['🚪', '♿', '❄️', '🚫', '⏱️', '🏁', '🎫', '📦', '🔗', '🛑', '📍', '⚠️'] },
];

export function SendMessageTab({ session }: SendMessageTabProps) {
  const [cannedOptions, setCannedOptions] = useState<CannedOption[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const { options } = await api.getCannedOptions();
        setCannedOptions(options.filter(o => o.category === 'DRIVER_TO_DISPATCH'));
      } catch (err) {
        console.error('Failed to load canned options:', err);
      }
    };
    loadOptions();
  }, []);

  const sendMessage = async (content: string) => {
    if (!session.timetableId) return;
    
    setSending(true);
    try {
      await api.sendMessageWS({
        receiverClientId: 'DISPATCHER',
        content,
        type: 'STATUS',
      });
      setSentMessage(content);
      setTimeout(() => setSentMessage(null), 3000);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleCannedClick = (template: string) => {
    sendMessage(template);
  };

  const handleCustomSend = () => {
    if (customMessage.trim()) {
      sendMessage(customMessage.trim());
      setCustomMessage('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-rail-text mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-rail-gold" />
          Quick Messages to Dispatcher
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {cannedOptions.map((option, idx) => (
            <button
              key={option.id}
              onClick={() => handleCannedClick(option.templateText)}
              disabled={sending}
              className="btn-secondary h-20 flex flex-col items-center justify-center gap-2 text-left p-3"
            >
              <span className="text-2xl">{MESSAGE_GROUPS[0].icons[idx] || '📋'}</span>
              <span className="text-sm font-medium text-center">{option.label}</span>
            </button>
          ))}
          {cannedOptions.length === 0 && (
            <div className="col-span-2 text-center py-8 text-rail-textMuted">Loading messages...</div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-rail-text mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-rail-gold" />
          Custom Message
        </h3>
        <div className="flex gap-2">
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="input flex-1 min-h-[80px] resize-none"
            placeholder="Type custom message to dispatcher..."
            disabled={sending}
            rows={3}
          />
          <button
            onClick={handleCustomSend}
            disabled={sending || !customMessage.trim()}
            className="btn-primary self-end mb-px"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {sentMessage && (
        <div className="animate-in flex items-center gap-2 p-3 bg-rail-green/10 border border-rail-green/30 rounded-lg text-rail-green">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm">Message sent: {sentMessage.substring(0, 50)}...</span>
        </div>
      )}
    </div>
  );
}
