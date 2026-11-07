import { makeObjectSetterRecursive } from './utils/makeProtectedObject.js';

import { recursiveAssign } from './utils/recursiveAssign.js';
import type { UserControlUpdate, UserControlsFull } from '../../shared/UserControls.js';
// State of the system with initial values
export const realControls: UserControlsFull = {
  sequence: 0,
};

export const protectedControls = makeObjectSetterRecursive(realControls, {
  sequence: (next: any): void => {
    // TODO: validate sequence somehow
    if (Number.isFinite(next)) realControls.sequence = next;
  },
});

/**
 * Update the internal `state.userControls` with new sanitized values.
 *
 * @param userControlsUpdate Incoming changes to user controls
 */
export function handleIncomingControls(userControlsUpdate: UserControlUpdate): void {
  recursiveAssign(protectedControls, userControlsUpdate);
}
