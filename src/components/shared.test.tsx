import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import ErrorView from "./Error";
import Header from "./Header";
import LoadingSpinner, { LoadingSpinnerFullscreen } from "./LoadingSpinner";
import NotFound from "./NotFound";

const withRouter = (ui: ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Header", () => {
  it("links back to the home page", () => {
    withRouter(<Header />);
    expect(
      screen.getByRole("link", { name: "Lightning Explorer" }),
    ).toHaveAttribute("href", "/");
  });
});

describe("Error", () => {
  it("renders an Error instance's message", () => {
    withRouter(<ErrorView error={new Error("boom")} />);
    expect(screen.getByRole("heading", { name: "Error" })).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it("stringifies non-Error values", () => {
    withRouter(<ErrorView error="raw failure" />);
    expect(screen.getByText("raw failure")).toBeInTheDocument();
  });
});

describe("NotFound", () => {
  it("renders a not-found heading", () => {
    withRouter(<NotFound />);
    expect(
      screen.getByRole("heading", { name: "Not found" }),
    ).toBeInTheDocument();
  });
});

describe("LoadingSpinner", () => {
  it("renders an animated spinner", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders a fullscreen spinner", () => {
    const { container } = render(<LoadingSpinnerFullscreen />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});
