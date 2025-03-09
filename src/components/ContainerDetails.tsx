import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import {
  ArrowLeft,
  RefreshCw,
  Server,
  Cpu,
  MemoryStick,
  Network,
  HardDrive,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDockerEvents } from "@/lib/docker-events-context";
import { DockerEvent, isContainerEvent, debounce } from "@/lib/docker-events";

interface ContainerStats {
  cpu_usage_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_usage_percent: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  block_read_bytes: number;
  block_write_bytes: number;
}

interface PortMapping {
  host_ip: string;
  host_port: string;
  container_port: string;
  protocol: string;
}

interface VolumeMapping {
  host_path: string;
  container_path: string;
  mode: string;
}

interface ContainerConfig {
  id: string;
  name: string;
  image: string;
  command: string;
  created: string;
  status: string;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  env_vars: string[];
  labels: Record<string, string>;
  network_mode: string;
  restart_policy: string;
}

interface ContainerDetailsProps {
  containerId: string;
  containerName: string;
  onBack: () => void;
}

export default function ContainerDetails({
  containerId,
  containerName,
  onBack,
}: ContainerDetailsProps) {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [config, setConfig] = useState<ContainerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(2000);
  const [activeTab, setActiveTab] = useState<"stats" | "config">("stats");
  const [isHighlighted, setIsHighlighted] = useState(false);

  // Get Docker events
  const { addEventHandler, removeEventHandler } = useDockerEvents();

  // Format bytes to human-readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Fetch container stats
  const fetchStats = async () => {
    try {
      const containerStats = await invoke<ContainerStats>(
        "get_container_stats",
        {
          containerId,
        }
      );
      setStats(containerStats);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch container stats:", err);
      setError(`Failed to fetch container stats: ${err}`);
    }
  };

  // Fetch container configuration
  const fetchConfig = async () => {
    try {
      const containerConfig = await invoke<ContainerConfig>(
        "get_container_config",
        {
          containerId,
        }
      );
      setConfig(containerConfig);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch container config:", err);
      setError(`Failed to fetch container configuration: ${err}`);
    }
  };

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchConfig()]);
    setLoading(false);
  };

  // Create a debounced version of fetchData to avoid excessive updates
  const debouncedFetchData = useCallback(debounce(fetchData, 500), [
    containerId,
  ]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [containerId]);

  // Handle Docker events for this specific container
  useEffect(() => {
    const handleContainerEvent = (event: DockerEvent) => {
      if (isContainerEvent(event, containerId)) {
        console.log(`Container event detected for ${containerId}:`, event);

        // Highlight the container details briefly
        setIsHighlighted(true);
        setTimeout(() => setIsHighlighted(false), 2000);

        // Refresh the container data
        debouncedFetchData();
      }
    };

    addEventHandler(handleContainerEvent);

    return () => {
      removeEventHandler(handleContainerEvent);
    };
  }, [containerId, addEventHandler, removeEventHandler, debouncedFetchData]);

  // Set up refresh interval for stats
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      if (activeTab === "stats") {
        fetchStats();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, activeTab]);

  // Toggle auto-refresh
  const toggleRefresh = () => {
    setRefreshInterval(refreshInterval ? null : 2000);
  };

  // Render loading state
  if (loading && !stats && !config) {
    return (
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">{containerName}</h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">{containerName}</h2>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
            <Button className="mt-4" onClick={fetchData}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col space-y-4 p-4 ${
        isHighlighted ? "bg-primary/5 transition-colors duration-500" : ""
      }`}
    >
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">{containerName}</h2>
        <Badge variant={config?.status === "running" ? "default" : "secondary"}>
          {config?.status || "unknown"}
        </Badge>
      </div>

      <div className="flex space-x-2 mb-4">
        <Button
          variant={activeTab === "stats" ? "default" : "outline"}
          onClick={() => setActiveTab("stats")}
        >
          <Cpu className="mr-2 h-4 w-4" />
          Stats
        </Button>
        <Button
          variant={activeTab === "config" ? "default" : "outline"}
          onClick={() => setActiveTab("config")}
        >
          <Server className="mr-2 h-4 w-4" />
          Configuration
        </Button>
        {activeTab === "stats" && (
          <Button variant="outline" onClick={toggleRefresh}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                refreshInterval ? "animate-spin" : ""
              }`}
            />
            {refreshInterval ? "Auto-refresh On" : "Auto-refresh Off"}
          </Button>
        )}
      </div>

      {activeTab === "stats" && stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <Cpu className="mr-2 h-5 w-5" />
                CPU Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                <div className="text-3xl font-bold">
                  {stats.cpu_usage_percent.toFixed(2)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{
                      width: `${Math.min(stats.cpu_usage_percent, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <MemoryStick className="mr-2 h-5 w-5" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                <div className="text-3xl font-bold">
                  {stats.memory_usage_percent.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-500">
                  {formatBytes(stats.memory_usage)} /{" "}
                  {formatBytes(stats.memory_limit)}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div
                    className="bg-green-600 h-2.5 rounded-full"
                    style={{
                      width: `${Math.min(stats.memory_usage_percent, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <Network className="mr-2 h-5 w-5" />
                Network I/O
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Received</div>
                  <div className="text-xl font-bold">
                    {formatBytes(stats.network_rx_bytes)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Transmitted</div>
                  <div className="text-xl font-bold">
                    {formatBytes(stats.network_tx_bytes)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                <HardDrive className="mr-2 h-5 w-5" />
                Disk I/O
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Read</div>
                  <div className="text-xl font-bold">
                    {formatBytes(stats.block_read_bytes)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Write</div>
                  <div className="text-xl font-bold">
                    {formatBytes(stats.block_write_bytes)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {activeTab === "config" && config && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Container ID</TableCell>
                    <TableCell>{config.id}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Name</TableCell>
                    <TableCell>{config.name}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Image</TableCell>
                    <TableCell>{config.image}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Command</TableCell>
                    <TableCell>
                      <code className="bg-gray-100 p-1 rounded">
                        {config.command}
                      </code>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Created</TableCell>
                    <TableCell>
                      {new Date(config.created).toLocaleString()}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Status</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          config.status === "running" ? "default" : "secondary"
                        }
                      >
                        {config.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Network Mode</TableCell>
                    <TableCell>{config.network_mode}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Restart Policy
                    </TableCell>
                    <TableCell>{config.restart_policy}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {config.ports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Port Mappings</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Host IP</TableHead>
                      <TableHead>Host Port</TableHead>
                      <TableHead>Container Port</TableHead>
                      <TableHead>Protocol</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.ports.map((port, index) => (
                      <TableRow key={index}>
                        <TableCell>{port.host_ip || "0.0.0.0"}</TableCell>
                        <TableCell>{port.host_port}</TableCell>
                        <TableCell>{port.container_port}</TableCell>
                        <TableCell>{port.protocol}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {config.volumes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Volume Mappings</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Host Path</TableHead>
                      <TableHead>Container Path</TableHead>
                      <TableHead>Mode</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.volumes.map((volume, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">
                          {volume.host_path}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {volume.container_path}
                        </TableCell>
                        <TableCell>{volume.mode}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {config.env_vars.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 p-4 rounded-md">
                  <pre className="text-sm overflow-x-auto">
                    {config.env_vars.map((env) => (
                      <div key={env}>{env}</div>
                    ))}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {Object.keys(config.labels).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Labels</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(config.labels).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="font-mono text-sm">
                          {key}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {value}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}
