import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavLink } from "./nav-link";

describe("NavLink", () => {
  it("links available routes", () => {
    render(<NavLink item={{ title: "Home", href: "/", milestone: 2 }} />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("renders unavailable routes as disabled text, not links", () => {
    render(<NavLink item={{ title: "Timeline", href: "/timeline", milestone: 13 }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const el = screen.getByText("Timeline");
    expect(el).toHaveAttribute("aria-disabled", "true");
    expect(el).toHaveAttribute("title", "Coming in Milestone 13");
    expect(el).toHaveTextContent("Timeline (coming soon)");
  });
});
