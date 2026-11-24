import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isMobileKeyboardViewport,
  resolveMobileOpenViewportStyle,
  useMobileVisualViewport,
} from "./mobileVisualViewport";
import { STANDALONE_MOBILE_OPEN_VIEWPORT } from "./ChatWidgetInner";

class FakeVisualViewport extends EventTarget {
  height: number;
  width: number;
  offsetTop: number;
  offsetLeft: number;

  constructor(init: { height: number; width: number; offsetTop?: number; offsetLeft?: number }) {
    super();
    this.height = init.height;
    this.width = init.width;
    this.offsetTop = init.offsetTop ?? 0;
    this.offsetLeft = init.offsetLeft ?? 0;
  }

  update(next: Partial<{ height: number; width: number; offsetTop: number; offsetLeft: number }>, eventType: "resize" | "scroll" = "resize") {
    Object.assign(this, next);
    this.dispatchEvent(new Event(eventType));
  }
}

const Probe: React.FC<{ active: boolean }> = ({ active }) => {
  const { metrics, isKeyboardOpen } = useMobileVisualViewport(active);
  const style = resolveMobileOpenViewportStyle(metrics, STANDALONE_MOBILE_OPEN_VIEWPORT);
  return (
    <div
      data-testid="viewport-probe"
      data-keyboard-open={String(isKeyboardOpen)}
      style={style}
    />
  );
};

const originalVisualViewport = window.visualViewport;
const originalInnerHeight = window.innerHeight;

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: originalVisualViewport,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: originalInnerHeight,
  });
  vi.restoreAllMocks();
});

describe("mobileVisualViewport", () => {
  it("keeps the full dynamic viewport when the mobile keyboard is closed", () => {
    const metrics = {
      layoutHeight: 740,
      viewportHeight: 740,
      viewportWidth: 360,
      offsetTop: 0,
      offsetLeft: 0,
    };
    expect(isMobileKeyboardViewport(metrics)).toBe(false);
    expect(resolveMobileOpenViewportStyle(metrics, STANDALONE_MOBILE_OPEN_VIEWPORT)).toEqual(
      STANDALONE_MOBILE_OPEN_VIEWPORT,
    );
  });

  it("pins the open widget to the shrinking Android visualViewport so the composer stays visible", () => {
    const metrics = {
      layoutHeight: 740,
      viewportHeight: 432,
      viewportWidth: 360,
      offsetTop: 0,
      offsetLeft: 0,
    };
    expect(isMobileKeyboardViewport(metrics)).toBe(true);
    expect(resolveMobileOpenViewportStyle(metrics, STANDALONE_MOBILE_OPEN_VIEWPORT)).toMatchObject({
      top: "0px",
      left: "0px",
      right: "auto",
      bottom: "auto",
      width: "360px",
      height: "432px",
      maxHeight: "432px",
    });
  });

  it("follows iOS Safari visualViewport offsetTop and height without jumping off-screen", () => {
    const metrics = {
      layoutHeight: 844,
      viewportHeight: 468,
      viewportWidth: 390,
      offsetTop: 52,
      offsetLeft: 0,
    };
    expect(isMobileKeyboardViewport(metrics)).toBe(true);
    expect(resolveMobileOpenViewportStyle(metrics, STANDALONE_MOBILE_OPEN_VIEWPORT)).toMatchObject({
      top: "52px",
      left: "0px",
      width: "390px",
      height: "468px",
      maxHeight: "468px",
    });
  });

  it("reacts to live visualViewport resize and scroll events and restores 100dvh when dismissed", () => {
    const fakeVv = new FakeVisualViewport({ height: 740, width: 360, offsetTop: 0 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 740 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: fakeVv });

    render(<Probe active />);
    const probe = screen.getByTestId("viewport-probe");
    expect(probe).toHaveAttribute("data-keyboard-open", "false");
    expect(probe.style.height).toBe("100dvh");

    act(() => {
      fakeVv.update({ height: 420, offsetTop: 36 }, "resize");
    });
    expect(probe).toHaveAttribute("data-keyboard-open", "true");
    expect(probe.style.top).toBe("36px");
    expect(probe.style.height).toBe("420px");

    act(() => {
      fakeVv.update({ offsetTop: 64 }, "scroll");
    });
    expect(probe.style.top).toBe("64px");

    act(() => {
      fakeVv.update({ height: 740, offsetTop: 0 }, "resize");
    });
    expect(probe).toHaveAttribute("data-keyboard-open", "false");
    expect(probe.style.height).toBe("100dvh");
  });
});

describe("welcome card double-border avoidance and safe-area preservation", () => {
  it("removes the outer card border inside the chat message scroll area while preserving focus and touch targets", () => {
    const css = readFileSync(
      path.resolve(__dirname, "institutionalChatMessage.css"),
      "utf8",
    );
    expect(css).toContain(".chatboc-chat-scrollarea .institutional-chat-message");
    expect(css).toMatch(/\.chatboc-chat-scrollarea\s+\.institutional-chat-message\s*\{[^}]*border:\s*0/);
    expect(css).toContain(":focus-visible { outline:3px solid hsl(var(--ring)); outline-offset:3px; }");
    expect(css).toContain("min-height:48px;");
  });

  it("keeps safe-area-inset-bottom on the chat composer footer", () => {
    const panelSource = readFileSync(path.resolve(__dirname, "ChatPanel.tsx"), "utf8");
    expect(panelSource).toContain("env(safe-area-inset-bottom)");
  });
});
