import { describe, expect, it } from 'vitest';

import { resolveLiveChatRequestAction } from './liveChatCta';

describe('resolveLiveChatRequestAction', () => {
  it('uses the offline action published by the backend contract', () => {
    expect(
      resolveLiveChatRequestAction({
        mode: 'offline',
        cta: {
          primary: {
            id: 'leave_message',
            action: 'queue_offline_message',
            mode: 'offline',
          },
        },
      }),
    ).toEqual({
      action: 'queue_offline_message',
      text: 'Quiero dejar un mensaje para el equipo',
      payload: { cta_id: 'leave_message', mode: 'offline' },
    });
  });

  it('keeps request_agent as a compatibility fallback', () => {
    expect(resolveLiveChatRequestAction(null).action).toBe('request_agent');
  });
});
