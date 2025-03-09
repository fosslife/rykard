import React from "react";
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Info,
  Bell,
  Shield,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/components/ui/theme-provider";
import { Separator } from "@/components/ui/separator";

interface SettingsDrawerProps {
  isCollapsed: boolean;
}

export function SettingsDrawer({ isCollapsed }: SettingsDrawerProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className={`w-full flex items-center ${
            isCollapsed ? "justify-center" : "space-x-3"
          } px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50`}
        >
          <span className="flex-shrink-0">
            <Settings size={20} />
          </span>
          {!isCollapsed && <span className="whitespace-nowrap">Settings</span>}
        </button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure your application preferences
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto">
          {/* Appearance Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Appearance</h3>
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Theme</label>
                  <p className="text-xs text-muted-foreground">
                    Select your preferred theme
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className="w-9 h-9 p-0"
                  >
                    <Sun className="h-4 w-4" />
                    <span className="sr-only">Light</span>
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className="w-9 h-9 p-0"
                  >
                    <Moon className="h-4 w-4" />
                    <span className="sr-only">Dark</span>
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                    className="w-9 h-9 p-0"
                  >
                    <Monitor className="h-4 w-4" />
                    <span className="sr-only">System</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Docker Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Docker</h3>
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Connection</label>
                  <p className="text-xs text-muted-foreground">
                    Docker daemon connection settings
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Database className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Notifications</h3>
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    Container Events
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Get notified about container status changes
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">About</h3>
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Version</label>
                  <p className="text-xs text-muted-foreground">Rykard v0.1.0</p>
                </div>
                <Button variant="outline" size="sm">
                  <Info className="h-4 w-4 mr-2" />
                  Details
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
