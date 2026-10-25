import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PlayerApp } from "./PlayerApp";

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<PlayerApp />
	</StrictMode>
);
