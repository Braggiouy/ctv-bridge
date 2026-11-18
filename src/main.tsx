import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { migrateLegacyStorage } from "./lib/workflow";
import "./index.css";

migrateLegacyStorage();

createRoot(document.getElementById("root")!).render(<App />);
