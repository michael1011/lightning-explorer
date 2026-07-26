import App from "@/App";
import Channel from "@/components/Channel";
import Node from "@/components/Node";
import NotFound from "@/components/NotFound";
import Resolver from "@/components/Resolver";
import Search from "@/components/Search";
import { ThemeProvider } from "@/components/theme-provider";
import { fetcher } from "@/lib/utils";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { SWRConfig } from "swr";

import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <SWRConfig value={{ fetcher, errorRetryCount: 0 }}>
        <BrowserRouter>
          <Routes>
            <Route index path="/" element={<App />} />
            <Route path="node/:node" element={<Node />} />
            <Route path="edge/:channel" element={<Channel />} />
            <Route path="channel/:channel" element={<Channel />} />
            <Route path="search/:query" element={<Search />} />
            <Route path="resolver/:input" element={<Resolver />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SWRConfig>
    </ThemeProvider>
  </StrictMode>,
);
