import type { UserControllable, UserControlsFull } from '../../../shared/UserControls';
import socket from '.';
import { useCallback, type DependencyList } from 'react';
import type { RecursivePartial } from '../utils/RecursivePartial';

let sequence = 0;

/**
 * Update controls state on backend.
 * @future Eventually, maybe this will return something for optimistic updates?
 * @param update The new Controls to send to backend
 */
export function updateUserControls(update: UserControllable): void {
  const userControls: RecursivePartial<UserControlsFull> = update;

  userControls.sequence = sequence++;

  socket.emit('userControls', userControls);

  console.log('Sending user controls:', userControls);
}

export function useUserControls<T extends any[]>(
  event: (...args: T) => UserControllable,
  deps: DependencyList = [],
): (...args: T) => ReturnType<typeof updateUserControls> {
  return useCallback((...args: T) => updateUserControls(event(...args)), [event, ...deps]);
}
