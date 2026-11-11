import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchCombobox } from "./search-combobox";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const suggestions = [
  {
    title: "The Complete History of the Buganda Kingdom",
    path: "/kingdoms/buganda",
    template: "KINGDOM",
    via: null,
  },
  { title: "History of Uganda", path: "/countries/uganda", template: "COUNTRY", via: "Buganda" },
];

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

describe("SearchCombobox", () => {
  it("shows suggestions and supports arrow keys, Enter and Escape", async () => {
    const fetchMock = vi.fn(async () => Response.json({ suggestions }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SearchCombobox />);
    const input = screen.getByRole("combobox");

    await user.type(input, "bug");
    const list = await screen.findByRole("listbox", { name: "Suggestions" });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(fetchMock).toHaveBeenCalledWith("/api/search/suggest?q=bug", expect.anything());
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(list).toHaveTextContent("mentions Buganda");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[1]!.id);
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/countries/uganda");

    await user.click(input);
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("does not ask for suggestions for a single character", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SearchCombobox />);
    await user.type(screen.getByRole("combobox"), "b");
    await new Promise((r) => setTimeout(r, 250));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps active filters when searching again", () => {
    const { container } = render(
      <SearchCombobox size="page" hiddenFields={{ type: "kingdoms" }} />,
    );
    expect(container.querySelector('input[type="hidden"][name="type"]')).toHaveValue("kingdoms");
  });
});
