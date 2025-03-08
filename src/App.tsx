import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "motion/react";
import ContainerList from "./components/ContainerList";
import ImageList from "./components/ImageList";
import Sidebar from "./components/Sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Boxes, HardDrive, Activity, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type View = "containers" | "images" | "dashboard";

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
}

interface ImageInfo {
  id: string;
  repo_tags: string[];
  size: number;
  created: number;
}

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const containerData = await invoke<ContainerInfo[]>("list_containers");
      const imageData = await invoke<ImageInfo[]>("list_images");
      setContainers(containerData);
      setImages(imageData);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      if (currentView === "dashboard") {
        fetchData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentView]);

  const runningContainers = containers.filter(
    (c) => c.state === "running"
  ).length;
  const stoppedContainers = containers.length - runningContainers;

  // Format the last refreshed time
  const formatLastRefreshed = () => {
    return lastRefreshed.toLocaleTimeString();
  };

  const handleSidebarToggle = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        onToggle={handleSidebarToggle}
      />

      <motion.main
        className="flex-1 p-4 md:p-6 overflow-auto"
        initial={{ paddingLeft: "1.5rem" }}
        animate={{ paddingLeft: isSidebarCollapsed ? "1.5rem" : "1.5rem" }}
        transition={{ duration: 0.2 }}
      >
        <AnimatePresence mode="wait">
          {currentView === "containers" && (
            <motion.div
              key="containers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="container mx-auto"
            >
              <ContainerList />
            </motion.div>
          )}

          {currentView === "images" && (
            <motion.div
              key="images"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="container mx-auto"
            >
              <ImageList />
            </motion.div>
          )}

          {currentView === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="container mx-auto"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                  <h1 className="text-3xl font-bold">Dashboard</h1>
                  <p className="text-muted-foreground">
                    Overview of your Docker environment
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Last updated: {formatLastRefreshed()}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    className="flex items-center gap-1"
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                    <DashboardCard
                      title="Containers"
                      value={containers.length.toString()}
                      description="Total containers"
                      icon={<Boxes className="h-5 w-5" />}
                      onClick={() => setCurrentView("containers")}
                      color="blue"
                    />
                    <DashboardCard
                      title="Running"
                      value={runningContainers.toString()}
                      description="Active containers"
                      icon={<Activity className="h-5 w-5" />}
                      onClick={() => setCurrentView("containers")}
                      color="green"
                    />
                    <DashboardCard
                      title="Images"
                      value={images.length.toString()}
                      description="Available images"
                      icon={<HardDrive className="h-5 w-5" />}
                      onClick={() => setCurrentView("images")}
                      color="purple"
                    />
                    <DashboardCard
                      title="Docker"
                      value="Running"
                      description="Engine status"
                      icon={<Database className="h-5 w-5" />}
                      onClick={() => {}}
                      color="gray"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle>Recent Containers</CardTitle>
                            <CardDescription>
                              Your most recently created containers
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-xs text-muted-foreground">
                                {runningContainers} Running
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                              <span className="text-xs text-muted-foreground">
                                {stoppedContainers} Stopped
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {containers.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">
                            No containers found
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {containers.slice(0, 5).map((container) => (
                              <motion.div
                                key={container.id}
                                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                                whileHover={{ x: 2 }}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div
                                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      container.state === "running"
                                        ? "bg-green-500"
                                        : "bg-gray-400"
                                    }`}
                                  />
                                  <span className="font-medium truncate">
                                    {container.names[0] ||
                                      container.id.substring(0, 12)}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground truncate max-w-[180px]">
                                  {container.image}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentView("containers")}
                          className="text-sm text-primary hover:text-primary/90"
                        >
                          View all containers
                        </Button>
                      </CardFooter>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>Recent Images</CardTitle>
                        <CardDescription>
                          Your most recently pulled images
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {images.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">
                            No images found
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {images.slice(0, 5).map((image, index) => {
                              const tag = image.repo_tags[0] || "<none>:<none>";
                              const [repo, tagName] = tag.split(":");

                              return (
                                <motion.div
                                  key={`${image.id}-${index}`}
                                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                                  whileHover={{ x: 2 }}
                                >
                                  <div className="font-medium truncate max-w-[180px]">
                                    {repo}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {tagName}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentView("images")}
                          className="text-sm text-primary hover:text-primary/90"
                        >
                          View all images
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  );
}

interface DashboardCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color: "blue" | "green" | "purple" | "gray";
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  description,
  icon,
  onClick,
  color,
}) => {
  const getColorClasses = () => {
    switch (color) {
      case "blue":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "green":
        return "bg-green-50 text-green-700 border-green-200";
      case "purple":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "gray":
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`border rounded-lg p-6 cursor-pointer shadow-sm hover:shadow-md transition-all ${getColorClasses()}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold">{value}</h3>
          <p className="text-sm mt-1 opacity-80">{description}</p>
        </div>
        <div className="p-2 rounded-full bg-white/80 shadow-sm">{icon}</div>
      </div>
    </motion.div>
  );
};

export default App;
