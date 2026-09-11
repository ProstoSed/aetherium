import { CloudHail, Disc3, Eclipse, Flame, MoveUpRight, Orbit, Radar, Snowflake, Sparkles, Sun, Waves, Zap, type LucideProps } from 'lucide-react';
import type { EventInfo } from '../../data/events';

const ICONS: Record<EventInfo['icon'], React.ComponentType<LucideProps>> = {
  Orbit, Eclipse, Sparkles, Disc3, Zap, Sun, MoveUpRight, Radar, CloudHail, Flame, Waves, Snowflake,
};

export function EventIcon({ icon, size = 18 }: { icon: EventInfo['icon']; size?: number }) {
  const Icon = ICONS[icon];
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
