import type { ActiveSession } from '../../../lib/types';

interface ActiveTabProps {
  sessions: ActiveSession[];
}

export function ActiveTab({ sessions }: ActiveTabProps) {
  return (
    <div className="p-4">
      <p className="text-rail-textMuted">Active tab - {sessions.length} sessions</p>
    </div>
  );
}
