import { useState, useEffect } from 'react';
import { Bell, X, Check, MessageSquare, AlertTriangle } from 'lucide-react';
import type { ActiveSession, Message } from '../../../lib/types';
import { api } from '../../../lib/api';
import { formatTime } from '../../../lib/utils';

interface InboxTabProps {
  session: ActiveSession;
  onUnreadChange: React.Dispatch<React.SetStateAction<number>>;
}

export function InboxTab({ session, onUnreadChange }: InboxTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoDismiss, setAutoDismiss] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const { messages: msgs } = await api.getMessages({ clientId: session.clientId, limit: 50 });
        setMessages(msgs);
        const unread = msgs.filter(m => !m.acknowledged && m.type === 'DISPATCH_POPUP').length;
        onUnreadChange(unread);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();

    const unsub = api.onWSMessage<Message>('new-message', (msg) => {
      setMessages((prev) => [msg, ...prev]);
      if (msg.type === 'DISPATCH_POPUP' && !msg.acknowledged) {
        onUnreadChange((prev) => prev + 1);
      }
    });

    const unsubPopup = api.onWSMessage<{ message: Message; duration: number }>('dispatch-popup', (data) => {
      setMessages((prev) => [data.message, ...prev]);
      onUnreadChange((prev) => prev + 1);
      
      if (autoDismiss && data.duration > 0) {
        setTimeout(() => {
          api.acknowledgeMessageWS(data.message.id);
          setMessages((prev) => prev.map(m => m.id === data.message.id ? { ...m, acknowledged: true } : m));
          onUnreadChange((prev) => Math.max(0, prev - 1));
        }, data.duration);
      }
    });

    return () => {
      unsub();
      unsubPopup();
    };
  }, [session.clientId, autoDismiss, onUnreadChange]);

  const handleAcknowledge = async (messageId: string) => {
    try {
      await api.acknowledgeMessage(messageId);
      setMessages((prev) => prev.map(m => m.id === messageId ? { ...m, acknowledged: true } : m));
      onUnreadChange((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to acknowledge:', err);
    }
  };

  const handleDismiss = async (messageId: string) => {
    await handleAcknowledge(messageId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-rail-textMuted">Loading messages...</div>
      </div>
    );
  }

  const dispatchPopups = messages.filter(m => m.type === 'DISPATCH_POPUP');
  const statusMessages = messages.filter(m => m.type === 'STATUS');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-rail-text flex items-center gap-2">
          <Bell className="w-5 h-5 text-rail-gold" />
          Dispatcher Inbox
        </h3>
        <label className="flex items-center gap-2 text-sm text-rail-textMuted cursor-pointer">
          <input
            type="checkbox"
            checked={autoDismiss}
            onChange={(e) => setAutoDismiss(e.target.checked)}
            className="w-4 h-4 accent-rail-gold"
          />
          Auto-dismiss popups
        </label>
      </div>

      {dispatchPopups.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-rail-textMuted uppercase tracking-wide">Active Pop-ups</h4>
          {dispatchPopups.map((msg) => (
            <div
              key={msg.id}
              className={`card animate-in border-l-4 ${
                msg.acknowledged ? 'border-rail-border opacity-50' : 'border-rail-red bg-rail-red/5'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-rail-text">{msg.content}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-rail-textMuted">
                    <span className="font-mono">{formatTime(msg.timestamp)}</span>
                    {msg.sender && <span>from {msg.sender.forteId}</span>}
                  </div>
                </div>
                {!msg.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(msg.id)}
                    className="btn-danger px-3 py-1.5 text-sm flex-shrink-0"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {statusMessages.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-rail-textMuted uppercase tracking-wide">Status Messages</h4>
          {statusMessages.slice(0, 20).map((msg) => (
            <div
              key={msg.id}
              className={`card p-3 ${msg.acknowledged ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-rail-blue flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-rail-text">{msg.content}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-rail-textMuted">
                    <span className="font-mono">{formatTime(msg.timestamp)}</span>
                    {msg.sender && <span>from {msg.sender.forteId}</span>}
                    {msg.acknowledged && <span className="text-rail-green">✓ Acknowledged</span>}
                  </div>
                </div>
                {!msg.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(msg.id)}
                    className="btn-ghost p-1.5 flex-shrink-0"
                  >
                    <Check className="w-4 h-4 text-rail-green" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {dispatchPopups.length === 0 && statusMessages.length === 0 && (
        <div className="text-center py-12 text-rail-textMuted">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No messages</p>
        </div>
      )}
    </div>
  );
}
