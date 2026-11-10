import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaFrame, RECONSTRUCTION_LABEL, type MediaFrameProps } from "./media-frame";

const base: MediaFrameProps = {
  src: "/example.jpg",
  alt: "Example",
  width: 800,
  height: 600,
  kind: "authentic_photo",
  caption: "A caption",
  date: "c. 1900",
  credit: {
    source: "Example Archive",
    sourceUrl: "https://archive.example/item/1",
    creator: "Unknown photographer",
    license: "Public domain",
    licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
  },
};

describe("MediaFrame", () => {
  it("labels authentic media by kind and credits source and licence", () => {
    render(<MediaFrame {...base} />);
    expect(screen.getByText("Archival photograph")).toBeInTheDocument();
    expect(screen.queryByText(RECONSTRUCTION_LABEL)).not.toBeInTheDocument();
    const source = screen.getByRole("link", { name: "Example Archive" });
    expect(source).toHaveAttribute("href", "https://archive.example/item/1");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Public domain" })).toBeInTheDocument();
    expect(screen.getByText(/Unknown photographer/)).toBeInTheDocument();
  });

  it("always shows the reconstruction label on the image and in the caption", () => {
    const { container } = render(<MediaFrame {...base} kind="ai_reconstruction" />);
    expect(screen.getAllByText(RECONSTRUCTION_LABEL)).toHaveLength(2);
    expect(container.querySelector("figure")).toHaveAttribute(
      "data-media-kind",
      "ai_reconstruction",
    );
  });

  it("renders credits as text when no URLs are known", () => {
    render(
      <MediaFrame
        {...base}
        kind="map"
        credit={{ source: "Private collection", license: "CC BY 4.0" }}
      />,
    );
    expect(screen.getByText("Historical map")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText(/Private collection/)).toBeInTheDocument();
  });
});
