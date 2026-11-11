import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { isRouteAvailable } from "@/config/navigation";
import HomePage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const specSections = [
  "Featured Historical Stories",
  "Today in History",
  "Explore the World",
  "Ancient Civilizations",
  "Kings and Queens",
  "Presidents and World Leaders",
  "Great African Kingdoms",
  "Historical Mysteries",
  "Famous Historical Figures",
  "History of Technology",
  "Interactive World Timeline",
  "Explore by Continent",
  "Latest Documentaries",
  "Popular Searches",
  "Recently Published Stories",
];

describe("HomePage", () => {
  it("has the specified headline and subheading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /discover the story of our world/i,
    );
    expect(
      screen.getByText(
        "Every civilization. Every extraordinary life. Every event that shaped humanity.",
      ),
    ).toBeInTheDocument();
  });

  it("renders all fifteen homepage sections in specification order", () => {
    render(<HomePage />);
    const h2s = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual(specSections);
  });

  it("does not link to routes that do not exist yet", () => {
    render(<HomePage />);
    for (const link of screen.queryAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      expect(href.startsWith("#") || href.startsWith("http") || isRouteAvailable(href), href).toBe(
        true,
      );
    }
  });

  it("shows honest empty states for data that does not exist yet", () => {
    render(<HomePage />);
    expect(screen.getByText("No documentaries published yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing published yet")).toBeInTheDocument();
    expect(screen.getByText("No events loaded yet")).toBeInTheDocument();
  });
});
