import { describe, expect, it } from 'vitest';

import {
  buildLiveChatJoinPayload,
  resolveLiveChatRealtimeAccess,
  resolveLiveChatRealtimeEnvelopeAccess,
} from './liveChatRealtime';

describe('liveChatRealtime', () => {
  it('reads a signed ticket room from the live-chat transport contract', () => {
    expect(
      resolveLiveChatRealtimeAccess({
        live_chat: {
          socket_room: 'ticket_municipio_42',
          transport: { access_token: 'signed-ticket-token' },
        },
      }),
    ).toEqual({
      room: 'ticket_municipio_42',
      accessToken: 'signed-ticket-token',
      ticketId: null,
      status: null,
    });
  });

  it('supports the top-level action response aliases', () => {
    expect(
      resolveLiveChatRealtimeAccess({
        socketRoom: 'ticket_pyme_7',
        liveChatAccessToken: 'signed-pyme-token',
        ticket_id: 7,
        status: 'esperando_agente_en_vivo',
      }),
    ).toEqual({
      room: 'ticket_pyme_7',
      accessToken: 'signed-pyme-token',
      ticketId: 7,
      status: 'esperando_agente_en_vivo',
    });
  });

  it('reads the nested action contract used by demo and education handoffs', () => {
    expect(
      resolveLiveChatRealtimeAccess({
        data: {
          ticket_id: 123,
          status: 'esperando_agente_en_vivo',
          socket_room: 'ticket_pyme_123',
          live_chat_access_token: 'nested-signed-token',
        },
      }.data),
    ).toEqual({
      room: 'ticket_pyme_123',
      accessToken: 'nested-signed-token',
      ticketId: 123,
      status: 'esperando_agente_en_vivo',
    });
  });

  it('keeps signed handoff data when the response also contains messages', () => {
    expect(
      resolveLiveChatRealtimeEnvelopeAccess({
        messages: [{ role: 'assistant', content: 'Te conectamos con el equipo.' }],
        data: {
          ticket_id: 321,
          status: 'esperando_agente_en_vivo',
          socket_room: 'ticket_municipio_321',
          live_chat_access_token: 'root-envelope-token',
        },
      }),
    ).toEqual({
      room: 'ticket_municipio_321',
      accessToken: 'root-envelope-token',
      ticketId: 321,
      status: 'esperando_agente_en_vivo',
    });
  });

  it('does not include an empty credential in the join payload', () => {
    expect(buildLiveChatJoinPayload('ticket_municipio_42', null)).toEqual({
      room: 'ticket_municipio_42',
    });
    expect(buildLiveChatJoinPayload('ticket_municipio_42', 'signed-ticket-token')).toEqual({
      room: 'ticket_municipio_42',
      access_token: 'signed-ticket-token',
    });
  });
});
