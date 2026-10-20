import type { ActiveSession } from '../../../lib/types';

interface NonActiveTabProps {
  sessions: ActiveSession[];
}

export function NonActiveTab({ sessions }: NonActiveTabProps) {
  return (
    <div className="p-4">
      <p className="text-rail-textMuted">Non-Active tab - {sessions.length} sessions</p>
    </div>
  );
}
