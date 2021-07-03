import io from 'socket.io-client';
import { State } from '../../shared/State';
import { isNullish } from '../utils/isNullish';

// config
const socketURL = '';

const socket = io(socketURL, {
  transports: ['websocket'],
});
export default socket;

// Make state available in console
socket.on('update', (state: State) => Object.assign(window, { state }));

socket.on('error', console.log.bind(0, 'Error:'));

// TODO: replace this with something much better
export const Store: { startupTime?: Date } = {};

// Get the daemon's startup time when it gives it to us
socket.on('startupTime', (msec: number) => (Store.startupTime = new Date(msec)));

// Pass orientation data back to server
window.addEventListener('deviceorientation', value => {
  if (isNullish(value?.alpha)) return;
  socket.emit('deviceorientation', value);
});
