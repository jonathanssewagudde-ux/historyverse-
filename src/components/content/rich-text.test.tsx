import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RichText } from "./rich-text";

describe("RichText", () => {
  it("renders paragraphs, emphasis and citation links with article-wide numbers", () => {
    const { container } = render(
      <RichText
        body={"Its ruler is the *kabaka*.[^1]\n\nIt was **restored** in 1993.[^2][^1]"}
        refs={{ 1: 4, 2: 7 }}
      />,
    );
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelector("em")).toHaveTextContent("kabaka");
    expect(container.querySelector("strong")).toHaveTextContent("restored");
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#ref-4", "#ref-7", "#ref-4"]);
    expect(links[0]).toHaveAccessibleName("Source 4");
  });

  it("never interprets markup in article text", () => {
    const { container } = render(
      <RichText body={'<img src=x onerror="alert(1)"> <script>alert(2)</script>'} refs={{}} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("drops markers that have no citation instead of showing a broken link", () => {
    const { container } = render(<RichText body="Claim.[^3]" refs={{}} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("Claim.");
  });
});
