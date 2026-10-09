import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AssignEmbed } from "../views/AssignEmbed";
import "../styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AssignEmbed />
  </StrictMode>,
);
