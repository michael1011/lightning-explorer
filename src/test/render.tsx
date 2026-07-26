import { fetcher } from "@/lib/utils";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { SWRConfig } from "swr";

// Render a component mounted at a route pattern so its useParams() resolves
// against `initialEntry` (e.g. pattern "node/:node", entry "/node/02abc…").
export const renderAtRoute = (
  pattern: string,
  element: ReactElement,
  initialEntry: string,
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={pattern} element={element} />
      </Routes>
    </MemoryRouter>,
  );

// Same as renderAtRoute, but wraps the tree in a fresh SWR cache using the real
// fetcher and no retries — for integration tests that drive the actual data
// layer with a mocked global.fetch instead of mocking useSWR.
export const renderWithProviders = (
  pattern: string,
  element: ReactElement,
  initialEntry: string,
) =>
  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        errorRetryCount: 0,
        fetcher,
      }}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={pattern} element={element} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
