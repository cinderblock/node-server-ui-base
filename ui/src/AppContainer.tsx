import { useDaemonStateUpdate } from './DaemonConnection/DaemonState';
import { useUserControls } from './DaemonConnection/UserControls';

function AppContainer() {
  const time = useDaemonStateUpdate(state => state.time);
  const sequence = useDaemonStateUpdate(state => state.userControls.sequence);

  return (
    <>
      <p>
        Daemon time:{' '}
        <output id="daemon-time">{time === undefined ? 'not connected' : new Date(time).toISOString()}</output>
      </p>
      <p>
        Last control sequence: <output id="control-sequence">{sequence ?? '?'}</output>
      </p>
      <button type="button" onClick={useUserControls(() => ({}))}>
        Hello world!
      </button>
    </>
  );
}

export default AppContainer;
