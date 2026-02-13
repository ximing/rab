import { getGlobalConfig } from './configure';
import { runAsReaction } from './internals/reactionRunner';
import { releaseReaction } from './internals/reactionTrack';
import type { Reaction, ReactionScheduler, Operation } from './internals/types';

const IS_REACTION = Symbol('is reaction');

// Options for observe function
export interface ObserveOptions {
  scheduler?: ReactionScheduler | Function;
  debugger?: (operation: Operation) => void;
  lazy?: boolean;
}

// Extended function type that can be a reaction
interface ReactionFunction extends Reaction {
  [IS_REACTION]?: boolean;
}

export function observe<T extends Function>(fn: T, options: ObserveOptions = {}): Reaction {
  // wrap the passed function in a reaction, if it is not already one
  let reaction: Reaction;

  if ((fn as unknown as ReactionFunction)[IS_REACTION]) {
    reaction = fn as unknown as Reaction;
  } else {
    // Create a named function that can reference itself
    const reactionFn = function reaction(this: unknown): unknown {
      // At runtime, 'reaction' will refer to the function itself
      return runAsReaction(reactionFn as unknown as Reaction, fn, this, arguments);
    };
    reaction = reactionFn as unknown as Reaction;
  }

  // save the scheduler and debugger on the reaction
  // 如果没有指定 scheduler,使用全局默认的 scheduler
  reaction.scheduler = options.scheduler ?? getGlobalConfig().scheduler;
  reaction.debugger = options.debugger;

  // save the fact that this is a reaction
  (reaction as ReactionFunction)[IS_REACTION] = true;

  // initialize cleaners array if not exists
  if (!reaction.cleaners) {
    reaction.cleaners = [];
  }

  // run the reaction once if it is not a lazy one
  if (!options.lazy) {
    reaction();
  }

  return reaction;
}

export function unobserve(reaction: Reaction): void {
  // do nothing, if the reaction is already unobserved
  if (!reaction.unobserved) {
    // indicate that the reaction should not be triggered any more
    reaction.unobserved = true;
    // release (obj -> key -> reaction) connections
    releaseReaction(reaction);
  }
  // unschedule the reaction, if it is scheduled
  if (typeof reaction.scheduler === 'object' && reaction.scheduler !== null) {
    reaction.scheduler.delete(reaction);
  }
}
