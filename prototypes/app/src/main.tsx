import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "primeicons/primeicons.css";
import "./fonts.css";
import "../theme/tokens.css";
import "./theme.generated.css";
import "./styles.css";

import App from "./App";
import { PrototypeProvider } from "./prototype-provider";
import { DEFAULT_ROUTE } from "./router";
import { initTheme } from "./theme";

if (!window.location.hash) {
  window.history.replaceState(null, "", `#${DEFAULT_ROUTE}`);
}

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrototypeProvider>
      <App />
    </PrototypeProvider>
  </StrictMode>,
);
