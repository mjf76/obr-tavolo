import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Controller } from "../views/Controller";
import "../styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Controller />
  </StrictMode>,
);
