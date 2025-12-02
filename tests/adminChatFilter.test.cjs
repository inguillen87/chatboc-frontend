import { describe, it, expect } from 'vitest';
import { filterLoginPrompt } from '../src/utils/adminChatFilter.js';

describe('filterLoginPrompt', () => {
  const text = 'Por favor, iniciá sesión para ver el catálogo';
  const buttons = [
    { texto: 'Login', action: 'login' },
    { texto: 'Otro', action: 'ver' }
  ];

  it('should filter login prompt for admin', () => {
    const admin = filterLoginPrompt(text, buttons, 'admin');
    expect(admin.text).toBe('');
    expect(admin.buttons.length).toBe(1);
    expect(admin.buttons[0].action).toBe('ver');
  });

  it('should not filter login prompt for user', () => {
    const user = filterLoginPrompt(text, buttons, 'usuario');
    expect(user.text).toBe(text);
    expect(user.buttons.length).toBe(2);
  });
});
