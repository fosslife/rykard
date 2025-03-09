import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "motion/react";
import ContainerList from "./components/ContainerList";
import ImageList from "./components/ImageList";
import ContainerDetails from "./components/ContainerDetails";
import Sidebar from "./components/Sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Boxes,
  HardDrive,
  Activity,
  Database,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  restoreStateCurrent,
  saveWindowState,
  StateFlags,
} from "@tauri-apps/plugin-window-state";
import { getCurrentWindow } from "@tauri-apps/api/window";

type View = "containers" | "images" | "dashboard" | "container-details";

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

enum DockerStatus {
  Connected = "Connected",
  Disconnected = "Disconnected",
  Error = "Error",
}

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [selectedContainer, setSelectedContainer] =
    useState<ContainerInfo | null>(null);

  // Initialize Docker client
  useEffect(() => {
    const initDocker = async () => {
      try {
        const status = await invoke<DockerStatus>("initialize_docker_client");
        console.log("Docker status:", status);
        setDockerStatus(status);
      } catch (error) {
        console.error("Failed to initialize Docker client:", error);
        setDockerStatus(DockerStatus.Error);
      }
    };

    initDocker();
  }, []);

  // Check Docker status periodically
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await invoke<DockerStatus>("get_docker_status");
        console.log("Docker status check:", status);
        setDockerStatus(status);
      } catch (error) {
        console.error("Failed to check Docker status:", error);
        setDockerStatus(DockerStatus.Error);
      }
    };

    // Check status immediately and then every 30 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    if (!dockerStatus || dockerStatus === DockerStatus.Error) {
      return;
    }

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
    if (dockerStatus && dockerStatus === DockerStatus.Connected) {
      fetchData();

      // Refresh data every 30 seconds
      // TODO: Replace with Docker event system
      const interval = setInterval(() => {
        if (currentView === "dashboard") {
          fetchData();
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [currentView, dockerStatus]);

  useEffect(() => {
    restoreStateCurrent(StateFlags.ALL);
    let unlisten = getCurrentWindow().onCloseRequested(() => {
      saveWindowState(StateFlags.ALL);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

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

  // Get Docker status text and color
  const getDockerStatusInfo = () => {
    if (!dockerStatus) {
      return { text: "Checking...", color: "gray" };
    }

    console.log(dockerStatus);

    if (dockerStatus === DockerStatus.Connected) {
      return { text: "Running", color: "green" };
    } else if (dockerStatus === DockerStatus.Disconnected) {
      return { text: "Stopped", color: "yellow" };
    } else if (dockerStatus === DockerStatus.Error) {
      return { text: "Error", color: "red" };
    }

    return { text: "Unknown", color: "gray" };
  };

  const dockerStatusInfo = getDockerStatusInfo();

  // Handle container selection for details view
  const handleContainerSelect = (container: ContainerInfo) => {
    setSelectedContainer(container);
    setCurrentView("container-details");
  };

  // Handle back navigation from container details
  const handleBackFromDetails = () => {
    setCurrentView("containers");
    setSelectedContainer(null);
  };

  // Render main content based on current view
  const renderContent = () => {
    if (dockerStatus && String(dockerStatus) === String(DockerStatus.Error)) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to connect to Docker. Please make sure Docker is running and
            try again.
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={async () => {
              try {
                setLoading(true);
                const status = await invoke<DockerStatus>(
                  "initialize_docker_client"
                );
                setDockerStatus(status);
                await fetchData();
              } catch (error) {
                console.error("Failed to reconnect to Docker:", error);
                setDockerStatus(DockerStatus.Error);
              } finally {
                setLoading(false);
              }
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reconnect
          </Button>
        </Alert>
      );
    }

    switch (currentView) {
      case "dashboard":
        return (
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
                  disabled={
                    loading ||
                    !dockerStatus ||
                    dockerStatus === DockerStatus.Error
                  }
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>

            {loading && containers.length === 0 && images.length === 0 ? (
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
                    value={dockerStatusInfo.text}
                    description="Engine status"
                    icon={<Database className="h-5 w-5" />}
                    onClick={() => {}}
                    color={dockerStatusInfo.color as any}
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
        );

      case "containers":
        return (
          <ContainerList
            containers={containers}
            onRefresh={fetchData}
            loading={loading}
            lastRefreshed={lastRefreshed}
            onContainerSelect={handleContainerSelect}
          />
        );

      case "container-details":
        if (!selectedContainer) {
          setCurrentView("containers");

          return null;
        }

        return (
          <ContainerDetails
            containerId={selectedContainer.id}
            containerName={
              selectedContainer.names[0] ||
              selectedContainer.id.substring(0, 12)
            }
            onBack={handleBackFromDetails}
          />
        );

      case "images":
        return (
          <ImageList
            images={images}
            onRefresh={fetchData}
            loading={loading}
            lastRefreshed={lastRefreshed}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar
        currentView={currentView as "containers" | "images" | "dashboard"}
        setCurrentView={(view) => setCurrentView(view as View)}
        onToggle={handleSidebarToggle}
      />

      <motion.main
        className="flex-1 p-4 md:p-6 overflow-auto"
        initial={{ paddingLeft: "1.5rem" }}
        animate={{ paddingLeft: isSidebarCollapsed ? "1.5rem" : "1.5rem" }}
        transition={{ duration: 0.2 }}
      >
        {renderContent()}
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
  color: "blue" | "green" | "purple" | "gray" | "yellow" | "red";
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
      case "yellow":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "red":
        return "bg-red-50 text-red-700 border-red-200";
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
