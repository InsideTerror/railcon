import type { ActiveSession } from '../../../lib/types';

interface IdleTabProps {
  sessions: ActiveSession[];
}

export function IdleTab({ sessions }: IdleTabProps) {
  return (
    <div className="p-4">
      <p className="text-rail-textMuted">Idle tab - {sessions.length} sessions</p>
    </div>
  );
}
