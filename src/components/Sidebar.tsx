import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Boxes, HardDrive, LayoutDashboard, Settings } from "lucide-react";

type View = "containers" | "images" | "dashboard";

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={20} />,
    },
    { id: "containers", label: "Containers", icon: <Boxes size={20} /> },
    { id: "images", label: "Images", icon: <HardDrive size={20} /> },
  ];

  return (
    <div className="w-[220px] h-screen bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold"
          >
            D
          </motion.div>
          <h1 className="text-xl font-bold">Docker Desktop</h1>
        </div>
      </div>

      <nav className="flex-1 py-4">
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
              width: "calc(100% - 16px)", // Adjust for padding
            }}
          />

          {navItems.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id as View}
              label={item.label}
              icon={item.icon}
              isActive={currentView === item.id}
              onClick={() => setCurrentView(item.id as View)}
            />
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <button
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={() => {}}
        >
          <span className="flex-shrink-0">
            <Settings size={20} />
          </span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

interface SidebarItemProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  id,
  label,
  icon,
  isActive,
  onClick,
}) => {
  return (
    <li className="relative list-none">
      <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md relative z-10 ${
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
        <span>{label}</span>
      </button>
    </li>
  );
};

export default Sidebar;
