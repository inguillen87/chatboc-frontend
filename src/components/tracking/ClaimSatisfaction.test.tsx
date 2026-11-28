import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/utils/api", () => ({ apiFetch }));
import { ClaimSatisfaction, parseClaimSatisfaction } from "./ClaimSatisfaction";

const contract = { available: true, submitted: false, rating: null, scale: 5, endpoint: "/api/public/tracking/claims/42/satisfaction", requires: ["pin", "rating"] };

describe("claim satisfaction", () => {
  beforeEach(() => { apiFetch.mockReset(); });

  it("accepts only the published contract", () => {
    expect(parseClaimSatisfaction(contract)).toEqual({ available: true, submitted: false, rating: null, endpoint: contract.endpoint });
    for (const bad of [null, [], { ...contract, scale: 10 }, { ...contract, rating: 7 }, { ...contract, endpoint: "https://evil.test/x" }, { ...contract, available: "yes" }])
      expect(parseClaimSatisfaction(bad)).toBeNull();
  });

  it("sends one rating with the PIN as a header and thanks the person", async () => {
    apiFetch.mockResolvedValue({ satisfaction: { ...contract, available: false, submitted: true, rating: 4 } });
    render(<ClaimSatisfaction state={parseClaimSatisfaction(contract)!} pin="654321" />);
    expect(screen.getByRole("heading", { name: "¿Cómo resolvieron tu reclamo?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bien" }));
    await screen.findByText("Tu respuesta: Bien.");
    const [url, options] = apiFetch.mock.calls[0];
    expect(url).toBe(contract.endpoint);
    expect(options).toMatchObject({ method: "POST", body: { rating: 4 }, pin: "654321", skipAuth: true, omitCredentials: true });
    expect(JSON.stringify(options.body)).not.toContain("654321");
    expect(screen.queryByRole("button", { name: "Muy bien" })).not.toBeInTheDocument();
  });

  it("keeps the choices and explains when the rating could not be saved", async () => {
    apiFetch.mockRejectedValue(new Error("offline"));
    render(<ClaimSatisfaction state={parseClaimSatisfaction(contract)!} pin="654321" />);
    fireEvent.click(screen.getByRole("button", { name: "Muy mal" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No pudimos guardar"));
    expect(screen.getByRole("button", { name: "Muy mal" })).toBeEnabled();
  });

  it("shows a rating already given and nothing for a claim still open", () => {
    const { rerender } = render(<ClaimSatisfaction state={{ available: false, submitted: true, rating: 5, endpoint: contract.endpoint }} pin="1" />);
    expect(screen.getByText("Tu respuesta: Muy bien.")).toBeInTheDocument();
    rerender(<ClaimSatisfaction state={{ available: false, submitted: false, rating: null, endpoint: contract.endpoint }} pin="1" />);
    expect(screen.queryByTestId("claim-satisfaction")).not.toBeInTheDocument();
  });
});
