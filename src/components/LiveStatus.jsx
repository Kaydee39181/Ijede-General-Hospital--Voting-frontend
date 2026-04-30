import { useEffect, useState } from 'react';
import { onSocketStateChanged } from '../services/socketService';

const LiveStatus = () => {
  const [connected, setConnected] = useState(false);

  useEffect(() => onSocketStateChanged(setConnected), []);

  return (
    <div className={`live-status ${connected ? 'online' : 'offline'}`}>
      <span className="status-dot" />
      <span>{connected ? 'Live updates connected' : 'Reconnecting live updates'}</span>
    </div>
  );
};

export default LiveStatus;
