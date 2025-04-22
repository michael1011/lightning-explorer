import App from "@/App";
import Node from "@/components/Node";
import Search from "@/components/Search";
import { ThemeProvider } from "@/components/theme-provider";
import { fetcher } from "@/lib/utils";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { SWRConfig } from "swr";

import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <SWRConfig value={{ fetcher }}>
        <BrowserRouter>
          <Routes>
            <Route index path="/" element={<App />} />
            <Route path="node/:node" element={<Node />} />
            <Route path="search/:query" element={<Search />} />
          </Routes>
        </BrowserRouter>
      </SWRConfig>
    </ThemeProvider>
  </StrictMode>,
);
