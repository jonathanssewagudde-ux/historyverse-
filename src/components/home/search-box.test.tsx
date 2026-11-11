import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchBox } from "./search-box";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("SearchBox", () => {
  it("is a search landmark whose form submits to /search, so it works without JavaScript", () => {
    render(<SearchBox suggestions={[]} />);
    const form = screen.getByRole("search", { name: "Search history" });
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    const input = screen.getByRole("combobox", { name: /search any country, person, kingdom/i });
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("links each starting point to a real search", () => {
    render(<SearchBox suggestions={["History of the Mali Empire"]} />);
    expect(screen.getByRole("link", { name: "History of the Mali Empire" })).toHaveAttribute(
      "href",
      "/search?q=History%20of%20the%20Mali%20Empire",
    );
  });
});
