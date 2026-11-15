import { useLayoutEffect, useState } from 'react';

/**
 * Local, in-memory playback URL for the audio draft the person is holding.
 *
 * The URL exists only while that same recording is the current draft: it is revoked when the
 * draft is sent, discarded, retired by a scope/session/capability change, replaced or unmounted.
 * Nothing is persisted and nothing plays on its own; playback is only through explicit controls.
 */
export function useDraftAudioUrl(recording: Blob | null): string | null {
  const [current, setCurrent] = useState<{ blob: Blob; url: string } | null>(null);
  useLayoutEffect(() => {
    if (!recording || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setCurrent(null);
      return;
    }
    const url = URL.createObjectURL(recording);
    setCurrent({ blob: recording, url });
    return () => {
      setCurrent(previous => previous?.url === url ? null : previous);
      try { URL.revokeObjectURL(url); } catch { /* The URL is retired either way. */ }
    };
  }, [recording]);
  // A URL is only ever shown for the recording it was created from.
  return current && current.blob === recording ? current.url : null;
}
