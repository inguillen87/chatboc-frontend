import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PlanUsagePanel from "@/components/profile/PlanUsagePanel";

const renderPanel = (plan: string, canManageBilling = true) =>
  render(
    <PlanUsagePanel
      canManageBilling={canManageBilling}
      limit={1_000}
      percentage={25}
      plan={plan}
      used={250}
    />,
  );

describe("PlanUsagePanel", () => {
  it.each(["pro", "full", "enterprise", "premium", "municipio_full", "colegio_full", "pyme_full"])(
    "treats %s as a paid plan without purchase calls to action",
    (plan) => {
      renderPanel(plan);

      expect(screen.getByText("Suscripción activa")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Ver Plan/i })).not.toBeInTheDocument();
    },
  );

  it("offers upgrades only for an explicitly free plan and an authorized administrator", () => {
    renderPanel("free");

    expect(screen.getByRole("button", { name: "Ver Plan Pro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver Plan Full" })).toBeInTheDocument();
  });

  it("does not guess billing state for an unknown plan", () => {
    renderPanel("custom-contract");

    expect(screen.getByText(/necesita validación de facturación/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver Plan/i })).not.toBeInTheDocument();
  });
});
