import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SaaSOperatingSystemSection from "./SaaSOperatingSystemSection";

describe("SaaSOperatingSystemSection", () => {
  it("presents one ordered operating flow without competing actions", () => {
    render(<SaaSOperatingSystemSection />);

    const section = screen.getByRole("region", { name: "Recibir, resolver y medir en un mismo flujo" });
    const steps = within(section).getAllByRole("listitem");

    expect(steps).toHaveLength(3);
    expect(within(section).getByRole("heading", { level: 3, name: "Recibir" })).toBeInTheDocument();
    expect(within(section).getByRole("heading", { level: 3, name: "Resolver" })).toBeInTheDocument();
    expect(within(section).getByRole("heading", { level: 3, name: "Medir" })).toBeInTheDocument();
    expect(within(section).queryByRole("button")).not.toBeInTheDocument();
  });
});
