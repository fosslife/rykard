import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ContainerList from "./components/ContainerList";
import ImageList from "./components/ImageList";
import Sidebar from "./components/Sidebar";

type View = "containers" | "images";

function App() {
  const [currentView, setCurrentView] = useState<View>("containers");

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="flex-1 p-6 overflow-auto">
        <div className="container mx-auto">
          {currentView === "containers" && <ContainerList />}
          {currentView === "images" && <ImageList />}
        </div>
      </main>
    </div>
  );
}

export default App;
