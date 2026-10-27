import React from "react";
import { createRoot } from "react-dom/client";
import { Intro } from "../src/Intro";
import "../src/style.css";
createRoot(document.getElementById("root")!).render(
  <Intro skipLabel="Audit: skip" onDone={() => {}} />,
);
