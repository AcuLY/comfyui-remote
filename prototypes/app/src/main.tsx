import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "./styles.css";

import App from "./App";
import { DEFAULT_ROUTE } from "./router";
import { initTheme } from "./theme";

if (!window.location.hash) {
  window.history.replaceState(null, "", `#${DEFAULT_ROUTE}`);
}

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
