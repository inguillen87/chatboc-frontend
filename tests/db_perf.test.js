import { describe, it, expect } from 'vitest';
import { getTicketMessagesById, __setMessages, getMessages } from '../db.js';

describe('db.js', () => {
  it('should return messages for a specific ticket', () => {
    const messages = [
      { id: 1, ticketId: 101, content: 'A' },
      { id: 2, ticketId: 102, content: 'B' },
      { id: 3, ticketId: 101, content: 'C' },
    ];
    __setMessages(messages);

    const result = getTicketMessagesById(101);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('A');
    expect(result[1].content).toBe('C');
  });

  it('should return empty array for non-existent ticket', () => {
    const messages = [
      { id: 1, ticketId: 101, content: 'A' },
    ];
    __setMessages(messages);

    const result = getTicketMessagesById(999);
    expect(result).toEqual([]);
  });

  it('should handle string ticketId', () => {
    const messages = [
      { id: 1, ticketId: 101, content: 'A' },
    ];
    __setMessages(messages);

    const result = getTicketMessagesById('101');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('A');
  });

  it('should update index when messages are set via __setMessages', () => {
    // Initial
    __setMessages([{ id: 1, ticketId: 1, content: 'First' }]);
    expect(getTicketMessagesById(1)).toHaveLength(1);

    // Update
    __setMessages([{ id: 2, ticketId: 2, content: 'Second' }]);
    expect(getTicketMessagesById(1)).toHaveLength(0);
    expect(getTicketMessagesById(2)).toHaveLength(1);
  });
});
