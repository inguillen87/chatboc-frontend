import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionConfig } from 'framer-motion';
import ChatbocLogoAnimated from './ChatbocLogoAnimated';
import TypingIndicator from './TypingIndicator';
import ProactiveBubble from './ProactiveBubble';
// Inspect the animation instructions passed to Framer; all API identities are synthetic.
vi.mock('framer-motion', async original => {
  const actual = await original<typeof import('framer-motion')>();
  const React = await import('react');
  const wrappers = new Map<string, React.ComponentType<any>>();
  return { ...actual, motion: new Proxy(actual.motion, { get: (_target, tag: string) => {
    if (!wrappers.has(tag)) wrappers.set(tag, React.forwardRef<HTMLElement, any>(function MotionFixture(props, ref) {
      const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
      return React.createElement(tag, { ...rest, ref, 'data-motion-initial': JSON.stringify(initial),
        'data-motion-animate': JSON.stringify(animate), 'data-motion-exit': JSON.stringify(exit), 'data-motion-duration': transition?.duration,
        'data-motion-repeat': transition?.repeat === Infinity ? 'infinite' : undefined });
    }));
    return wrappers.get(tag);
  } }) };
});



afterEach(cleanup);
describe('shared reduced motion descendants', () => {
  it('removes logo/typing loops and proactive transforms while preserving their content', () => {
    const content = <><ChatbocLogoAnimated blinking floating pulsing movingEyes smiling animation="bounce" />
      <TypingIndicator text="Procesando consulta sintética" />
      <ProactiveBubble visible message="Consulta de prueba" onClick={vi.fn()} onDismiss={vi.fn()} /></>;
    const view = render(<MotionConfig reducedMotion="always">{content}</MotionConfig>);
    expect(screen.getByText('Procesando consulta sintética')).toBeVisible();
    expect(screen.getByText('Consulta de prueba')).toBeVisible();
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).not.toBeInTheDocument();
    for (const node of view.container.querySelectorAll<HTMLElement>('[data-motion-animate]')) {
      const target = JSON.parse(node.dataset.motionAnimate || '{}');
      expect(Object.values(target).some(Array.isArray)).toBe(false);
    }
    expect(view.container.querySelector('img')?.style.animation).toBe('');
    view.rerender(<MotionConfig reducedMotion="user">{content}</MotionConfig>);
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).toBeInTheDocument();
    view.rerender(<MotionConfig reducedMotion="always">{content}</MotionConfig>);
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).not.toBeInTheDocument();
  });
});
