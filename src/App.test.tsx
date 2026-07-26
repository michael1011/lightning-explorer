import App from "@/App";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

describe("App", () => {
  it("renders the landing page", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Lightning Explorer" }),
    ).toBeInTheDocument();
  });
});
