import { useEffect, useState } from 'react';
import pusher from '../pusher';
import { Channel } from 'pusher-js';

export const usePusher = (channelName?: string | null) => {
  const [channel, setChannel] = useState<Channel | null>(null);

  useEffect(() => {
    if (!channelName) {
      setChannel(null);
      return undefined;
    }

    const pusherChannel = pusher.subscribe(channelName);
    setChannel(pusherChannel);

    return () => {
      pusher.unsubscribe(channelName);
    };
  }, [channelName]);

  return channel;
};
