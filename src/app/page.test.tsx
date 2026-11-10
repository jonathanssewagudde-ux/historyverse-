import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { milestones } from "@/config/milestones";
import FoundationPage from "./page";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }) }));

describe("FoundationPage", () => {
  it("renders the brand, tagline and a single h1", () => {
    render(<FoundationPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Every Story. Every Civilization. Every Century.",
    );
    expect(screen.getByText("HISTORYVERSE")).toBeInTheDocument();
  });

  it("lists all fifteen milestones in order", () => {
    render(<FoundationPage />);
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(15);
    expect(milestones.map((m) => m.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(items[0]).toHaveTextContent("Project Foundation");
    expect(items[14]).toHaveTextContent("Testing, Optimization, Launch");
  });

  it("exposes an accessible theme toggle", () => {
    render(<FoundationPage />);
    expect(screen.getByRole("button", { name: /toggle colour theme/i })).toBeInTheDocument();
  });
});
