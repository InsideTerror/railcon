import { useState } from 'react';
import { DutyActivityTab } from '../tabs/DutyActivityTab';
import { SendMessageTab } from '../tabs/SendMessageTab';
import { AnnouncementsTab } from '../tabs/AnnouncementsTab';
import { SettingsTab } from '../tabs/SettingsTab';
import { InboxTab } from '../tabs/InboxTab';
import type { ActiveSession } from '../../../lib/types';

interface NavigationTabsProps {
  session: ActiveSession;
}

const TABS = [
  { id: 'duty', label: 'Duty / Activity', icon: '📋' },
  { id: 'message', label: 'Send Message', icon: '📤' },
  { id: 'announcements', label: 'Announcements', icon: '📢' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'inbox', label: 'Inbox', icon: '📥' },
] as const;

export function NavigationTabs({ session }: NavigationTabsProps) {
  const [activeTab, setActiveTab] = useState<TABS[number]['id']>('duty');
  const [unreadCount, setUnreadCount] = useState(0);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'duty':
        return <DutyActivityTab session={session} />;
      case 'message':
        return <SendMessageTab session={session} />;
      case 'announcements':
        return <AnnouncementsTab session={session} />;
      case 'settings':
        return <SettingsTab session={session} />;
      case 'inbox':
        return <InboxTab session={session} onUnreadChange={setUnreadCount} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-rail-bg overflow-hidden">
      <div className="flex border-b border-rail-border bg-rail-panel shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-btn ${activeTab === tab.id ? 'tab-btn-active' : ''} relative`}
            aria-label={tab.label}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
            {tab.id === 'inbox' && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rail-red text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {renderTabContent()}
      </div>
    </div>
  );
}
