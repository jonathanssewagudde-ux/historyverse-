import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchBox } from "./search-box";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("SearchBox", () => {
  it("has an accessible search landmark and labelled input", () => {
    render(<SearchBox suggestions={[]} />);
    expect(screen.getByRole("search", { name: "Search history" })).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search any country, person, kingdom/i }),
    ).toBeInTheDocument();
  });

  it("does not pretend to search before the search engine exists", async () => {
    const user = userEvent.setup();
    render(<SearchBox suggestions={[]} />);
    await user.type(screen.getByRole("searchbox"), "Buganda{Enter}");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/Search is not open yet/);
  });

  it("ignores empty submissions", async () => {
    const user = userEvent.setup();
    render(<SearchBox suggestions={[]} />);
    await user.click(screen.getByRole("button", { name: /^search/i }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("fills the input from a suggestion and clears the notice on edit", async () => {
    const user = userEvent.setup();
    render(<SearchBox suggestions={["History of the Mali Empire"]} />);
    await user.click(screen.getByRole("button", { name: "History of the Mali Empire" }));
    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("History of the Mali Empire");
    expect(input).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).not.toBeEmptyDOMElement();
    await user.type(input, "!");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
