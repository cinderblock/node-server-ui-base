import { UserControlsFull } from './UserControls';

/**
 * The shape of shared state is defined here.
 *
 * State is *EVERYTHING* that we care about.
 * This includes, but is not limited to
 *  - Our "state" - as in State space control
 *  - The Time - Useful to know
 *  - The user controllable stuff
 */
export type State = {
  debug: {
    heapUsed: number;
    gc: {
      count: number;
      duration?: number;
      type?: 'Scavenge' | 'MarkSweepCompact';
    };
  };

  /**
   * System time, milliseconds.
   *
   * Do not use for dt calculations. Is mangled regularly.
   */
  time: number;

  /**
   * These are the ONLY things that the user gets to touch relatively directly.
   *
   * Values set by the UI are sanitized by `protectedControls`,
   * set in `./UserControls.ts`
   */
  userControls: UserControlsFull;
};
