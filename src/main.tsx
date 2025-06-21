import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { RoninWalletProvider } from "./services/wallet/RoninWalletProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RoninWalletProvider>
      <App />
    </RoninWalletProvider>
  </StrictMode>
);
