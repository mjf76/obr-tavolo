import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GmPanel } from "../views/gm/GmPanel";
import "../styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GmPanel />
  </StrictMode>,
);
