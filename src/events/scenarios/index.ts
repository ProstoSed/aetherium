import type { EventId } from '../../data/events';
import type { ScenarioFactory } from '../types';
import { alignment } from './alignment';
import { aliens } from './aliens';
import { blackhole } from './blackhole';
import { collision } from './collision';
import { comet } from './comet';
import { eclipse } from './eclipse';
import { flare } from './flare';
import { gravity } from './gravity';
import { ice } from './ice';
import { meteors } from './meteors';
import { rogue } from './rogue';
import { supernova } from './supernova';

export const SCENARIOS: Record<EventId, ScenarioFactory> = {
  alignment, eclipse, comet, blackhole, collision, supernova, rogue, aliens, meteors, flare, gravity, ice,
};
