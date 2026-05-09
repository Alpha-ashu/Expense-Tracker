import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/fonts.css";
import "./styles/index.css";
import { setupGlobalErrorHandlers } from "./lib/errorHandling";

// Wire global error handlers before rendering so uncaught errors and
// unhandled promise rejections are captured from app startup (F-4).
setupGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);