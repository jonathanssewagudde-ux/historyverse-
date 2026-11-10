import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EraTimeline } from "./era-timeline";

describe("EraTimeline", () => {
  it("implements the tabs pattern with arrow-key navigation", async () => {
    const user = userEvent.setup();
    render(<EraTimeline />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("era-range")).toHaveTextContent("Before c. 3200 BCE");

    tabs[0]!.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Ancient" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Ancient" })).toHaveFocus();

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Contemporary" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Prehistory" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("selects an era on click and labels the panel", async () => {
    const user = userEvent.setup();
    render(<EraTimeline />);
    await user.click(screen.getByRole("tab", { name: "Medieval" }));
    expect(await screen.findByText("c. 500 – c. 1500")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Medieval");
  });
});
