import React, { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ThemeToggle } from "./ui/theme-toggle";

type View = "containers" | "images" | "dashboard";

interface NavbarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  // Store refs to each nav item to calculate positions
  const itemsRef = useRef<Record<View, HTMLLIElement | null>>({
    dashboard: null,
    containers: null,
    images: null,
  });

  // Store the active indicator dimensions
  const [activeItem, setActiveItem] = useState<{
    left: number;
    width: number;
  } | null>(null);

  // Update the active indicator position when the current view changes
  useEffect(() => {
    const currentItemRef = itemsRef.current[currentView];
    if (currentItemRef) {
      const { offsetLeft, offsetWidth } = currentItemRef;
      setActiveItem({
        left: offsetLeft,
        width: offsetWidth,
      });
    }
  }, [currentView]);

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold"
          >
            D
          </motion.div>
          <h1 className="text-xl font-bold">Rykard</h1>
        </div>

        <nav className="hidden md:block">
          <ul className="flex space-x-1 relative">
            {/* Active indicator */}
            {activeItem && (
              <motion.div
                className="absolute bottom-0 h-1 bg-primary rounded-full"
                initial={false}
                animate={{
                  left: activeItem.left,
                  width: activeItem.width,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}

            {/* Nav items */}
            <NavItem
              label="Dashboard"
              isActive={currentView === "dashboard"}
              onClick={() => setCurrentView("dashboard")}
              ref={(el) => (itemsRef.current.dashboard = el)}
            />
            <NavItem
              label="Containers"
              isActive={currentView === "containers"}
              onClick={() => setCurrentView("containers")}
              ref={(el) => (itemsRef.current.containers = el)}
            />
            <NavItem
              label="Images"
              isActive={currentView === "images"}
              onClick={() => setCurrentView("images")}
              ref={(el) => (itemsRef.current.images = el)}
            />
          </ul>
        </nav>

        <div className="flex items-center space-x-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

interface NavItemProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const NavItem = React.forwardRef<HTMLLIElement, NavItemProps>(
  ({ label, isActive, onClick }, ref) => {
    return (
      <li ref={ref} className="relative">
        <button
          onClick={onClick}
          className={`px-4 py-1.5 rounded-md relative ${
            isActive
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
          {isActive && (
            <motion.div
              layoutId="activeTabIndicator"
              className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </button>
      </li>
    );
  }
);

NavItem.displayName = "NavItem";

export default Navbar;
