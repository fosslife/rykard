import React from "react";

type View = "containers" | "images";

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  return (
    <div className="w-64 bg-secondary border-r border-border">
      <div className="p-4">
        <h1 className="text-xl font-bold">Docker Desktop Alt</h1>
      </div>
      <nav className="mt-4">
        <ul>
          <li>
            <button
              className={`w-full text-left px-4 py-2 ${
                currentView === "containers"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary-foreground/10"
              }`}
              onClick={() => setCurrentView("containers")}
            >
              Containers
            </button>
          </li>
          <li>
            <button
              className={`w-full text-left px-4 py-2 ${
                currentView === "images"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary-foreground/10"
              }`}
              onClick={() => setCurrentView("images")}
            >
              Images
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
