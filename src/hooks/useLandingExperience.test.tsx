import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/api/landingExperience", () => ({ getLandingExperience: get }));
import { useLandingExperience } from "./useLandingExperience";

describe("landing contract refresh", () => {
  beforeEach(() => { get.mockReset(); });

  it("refreshes only on demand and discards the previous pending response", async () => {
    let first!: (value: unknown) => void;
    let second!: (value: unknown) => void;
    get.mockImplementationOnce(() => new Promise((resolve) => { first = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { second = resolve; }));
    const { result } = renderHook(() => useLandingExperience());
    expect(get).toHaveBeenCalledTimes(1);
    act(() => result.current.reload());
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await act(async () => first({ contact: { title: "Old" } }));
    expect(result.current.experience).toBeNull();
    expect(result.current.loading).toBe(true);
    await act(async () => second({ contact: { title: "Current" } }));
    expect(result.current.experience?.contact.title).toBe("Current");
    expect(result.current.loading).toBe(false);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("does not fetch while disabled, including after a manual refresh", () => {
    const { result } = renderHook(() => useLandingExperience({ enabled: false }));
    act(() => result.current.reload());
    expect(get).not.toHaveBeenCalled();
  });

  it('retires the transport lifetime on query change and unmount without an automatic retry', async () => {
    get.mockImplementation(() => new Promise(() => {}));
    const view = renderHook(({ tenantSlug }) => useLandingExperience({ tenantSlug }), {
      initialProps: { tenantSlug: 'synthetic-a' },
    });
    expect(get).toHaveBeenCalledTimes(1);
    const firstCurrent = get.mock.calls[0][1].isCurrent as () => boolean;
    expect(firstCurrent()).toBe(true);
    view.rerender({ tenantSlug: 'synthetic-b' });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    const secondCurrent = get.mock.calls[1][1].isCurrent as () => boolean;
    expect(firstCurrent()).toBe(false);
    expect(secondCurrent()).toBe(true);
    view.unmount();
    expect(secondCurrent()).toBe(false);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
