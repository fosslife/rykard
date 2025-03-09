import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Boxes,
  HardDrive,
  LayoutDashboard,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SettingsDrawer } from "./SettingsDrawer";

type View = "containers" | "images" | "dashboard";

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  onToggle?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  onToggle,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={20} />,
    },
    { id: "containers", label: "Containers", icon: <Boxes size={20} /> },
    { id: "images", label: "Images", icon: <HardDrive size={20} /> },
  ];

  const toggleSidebar = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (onToggle) {
      onToggle(newCollapsedState);
    }
  };

  // Notify parent component of initial collapse state
  useEffect(() => {
    if (onToggle) {
      onToggle(isCollapsed);
    }
  }, []);

  return (
    <motion.div
      className="h-screen bg-card border-r border-border flex flex-col"
      initial={{ width: 220 }}
      animate={{ width: isCollapsed ? 72 : 220 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <div className="py-4 px-6 border-b border-border flex items-center justify-between">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              className="flex items-center space-x-2 overflow-hidden"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                transition={{ duration: 1, ease: "easeInOut" }}
                className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold flex-shrink-0"
              >
                R
              </motion.div>
              <h1 className="text-xl font-bold whitespace-nowrap">Rykard</h1>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={toggleSidebar}
          className="text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-muted/50 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-hidden">
        <ul className="space-y-1 px-2 relative">
          {/* Active background that slides between items */}
          <motion.div
            className="absolute bg-primary rounded-md z-0"
            layoutId="activeNavBackground"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
            style={{
              width: isCollapsed ? "calc(100% - 16px)" : "calc(100% - 16px)", // Adjust for padding
            }}
          />

          {/* Nav items */}
          {navItems.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id as View}
              label={item.label}
              icon={item.icon}
              isActive={currentView === item.id}
              onClick={() => setCurrentView(item.id as View)}
              isCollapsed={isCollapsed}
            />
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <SettingsDrawer isCollapsed={isCollapsed} />
      </div>
    </motion.div>
  );
};

interface SidebarItemProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  id,
  label,
  icon,
  isActive,
  isCollapsed,
  onClick,
}) => {
  return (
    <li className="relative list-none">
      <button
        onClick={onClick}
        className={`w-full flex items-center ${
          isCollapsed ? "justify-center" : "space-x-3"
        } px-3 py-2 rounded-md relative z-10 ${
          isActive
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="activeNavBackground"
            className="absolute inset-0 bg-primary rounded-md -z-10"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          />
        )}
        <span className="flex-shrink-0">{icon}</span>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="whitespace-nowrap"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </li>
  );
};

export default Sidebar;
