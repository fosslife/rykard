import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import ContainerLogs from "./ContainerLogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Play,
  Square,
  Trash,
  FileText,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useDockerEvents } from "@/lib/docker-events-context";
import { DockerEvent, isContainerEvent } from "@/lib/docker-events";

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  labels: Record<string, string>;
}

interface ContainerListProps {
  containers: ContainerInfo[];
  loading: boolean;
  lastRefreshed: Date;
  onRefresh: () => Promise<void>;
  onContainerSelect?: (container: ContainerInfo) => void;
}

// Interface for grouped containers
interface ComposeGroup {
  projectName: string;
  containers: ContainerInfo[];
  isExpanded: boolean;
}

const ContainerList: React.FC<ContainerListProps> = ({
  containers,
  loading,
  lastRefreshed,
  onRefresh,
  onContainerSelect,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [affectedContainers, setAffectedContainers] = useState<Set<string>>(
    new Set()
  );
  const [composeGroups, setComposeGroups] = useState<ComposeGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Get Docker events
  const { addEventHandler, removeEventHandler } = useDockerEvents();

  // Handle Docker events for containers
  useEffect(() => {
    const handleContainerEvent = (event: DockerEvent) => {
      if (isContainerEvent(event)) {
        // Highlight the affected container
        const containerId = event.Actor.ID;
        setAffectedContainers((prev) => {
          const newSet = new Set(prev);
          newSet.add(containerId);

          // Remove the highlight after 2 seconds
          setTimeout(() => {
            setAffectedContainers((prev) => {
              const newSet = new Set(prev);
              newSet.delete(containerId);
              return newSet;
            });
          }, 2000);

          return newSet;
        });
      }
    };

    addEventHandler(handleContainerEvent);

    return () => {
      removeEventHandler(handleContainerEvent);
    };
  }, [addEventHandler, removeEventHandler]);

  // Group containers by Compose project
  useEffect(() => {
    // First, identify standalone containers and Compose containers
    const standaloneContainers: ContainerInfo[] = [];
    const composeContainers: ContainerInfo[] = [];

    containers.forEach((container) => {
      // Check if container has Compose labels
      if (container.labels["com.docker.compose.project"]) {
        composeContainers.push(container);
      } else {
        standaloneContainers.push(container);
      }
    });

    // Group Compose containers by project only (not by service)
    const groupMap = new Map<string, ComposeGroup>();

    composeContainers.forEach((container) => {
      const projectName =
        container.labels["com.docker.compose.project"] || "unknown";

      if (!groupMap.has(projectName)) {
        groupMap.set(projectName, {
          projectName,
          containers: [],
          isExpanded: expandedGroups.has(projectName),
        });
      }

      groupMap.get(projectName)?.containers.push(container);
    });

    // Convert the map to an array
    const groups = Array.from(groupMap.values());

    // Sort groups by project name
    groups.sort((a, b) => a.projectName.localeCompare(b.projectName));

    setComposeGroups(groups);
  }, [containers, expandedGroups]);

  // Toggle group expansion
  const toggleGroupExpansion = (projectName: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }

      return newSet;
    });
  };

  const handleStartContainer = async (containerId: string) => {
    try {
      setError(null);
      await invoke("start_container", { containerId });
      onRefresh();
    } catch (err) {
      console.error("Failed to start container:", err);
      setError(`Failed to start container: ${err}`);
    }
  };

  const handleStopContainer = async (containerId: string) => {
    try {
      setError(null);
      await invoke("stop_container", { containerId });
      onRefresh();
    } catch (err) {
      console.error("Failed to stop container:", err);
      setError(`Failed to stop container: ${err}`);
    }
  };

  const handleRemoveContainer = async (containerId: string) => {
    try {
      setError(null);
      await invoke("remove_container", { containerId });
      onRefresh();
    } catch (err) {
      console.error("Failed to remove container:", err);
      setError(`Failed to remove container: ${err}`);
    }
  };

  const handleViewLogs = (containerId: string, containerName: string) => {
    setSelectedContainer({ id: containerId, name: containerName });
  };

  const handleCloseLogs = () => {
    setSelectedContainer(null);
  };

  const handleViewDetails = (container: ContainerInfo) => {
    if (onContainerSelect) {
      onContainerSelect(container);
    }
  };

  const getStatusBadgeVariant = (state: string) => {
    switch (state) {
      case "running":
        return "success";
      case "exited":
        return "secondary";
      default:
        return "warning";
    }
  };

  // Get standalone containers (not part of Compose)
  const standaloneContainers = containers.filter(
    (container) => !container.labels["com.docker.compose.project"]
  );

  // Format the last refreshed time
  const formatLastRefreshed = () => {
    if (!lastRefreshed) return "Never";

    return new Date(lastRefreshed).toLocaleTimeString();
  };

  return (
    <div className="container mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Containers</h1>
          <p className="text-muted-foreground">Manage your Docker containers</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Last updated: {formatLastRefreshed()}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="flex items-center gap-1"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Container List</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {loading && containers.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : containers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No containers found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Render Compose groups */}
                  {composeGroups.map((group) => {
                    const isExpanded = expandedGroups.has(group.projectName);

                    // Get the first container to represent the group
                    const representativeContainer = group.containers[0];

                    // Determine if any container in the group is running
                    const isAnyRunning = group.containers.some(
                      (c) => c.state === "running"
                    );

                    return (
                      <React.Fragment key={group.projectName}>
                        {/* Group row */}
                        <TableRow
                          className="group cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            toggleGroupExpansion(group.projectName)
                          }
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 mr-2 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 mr-2 text-muted-foreground" />
                              )}
                              <span className="font-semibold">
                                {group.projectName}
                              </span>
                              <Badge className="ml-2" variant="outline">
                                {group.containers.length}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>Multiple services</TableCell>
                          <TableCell>
                            <Badge
                              variant={isAnyRunning ? "default" : "secondary"}
                            >
                              {isAnyRunning ? "Running" : "Stopped"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {/* Group actions can be added here if needed */}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Individual containers in the group */}
                        {isExpanded &&
                          group.containers.map((container) => (
                            <TableRow
                              key={container.id}
                              className={`bg-muted/20 ${
                                affectedContainers.has(container.id)
                                  ? "bg-primary/10 transition-colors duration-500"
                                  : ""
                              }`}
                            >
                              <TableCell className="font-medium pl-10">
                                {container.labels[
                                  "com.docker.compose.service"
                                ] ||
                                  container.names[0] ||
                                  "Unnamed"}
                              </TableCell>
                              <TableCell>{container.image}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    container.state === "running"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {container.state}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {container.state === "running" ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStopContainer(container.id);
                                      }}
                                      title="Stop Container"
                                    >
                                      <Square className="h-4 w-4" />
                                      <span className="sr-only">Stop</span>
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartContainer(container.id);
                                      }}
                                      title="Start Container"
                                    >
                                      <Play className="h-4 w-4" />
                                      <span className="sr-only">Start</span>
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewLogs(
                                        container.id,
                                        container.names[0] ||
                                          container.id.substring(0, 12)
                                      );
                                    }}
                                    title="View Logs"
                                  >
                                    <FileText className="h-4 w-4" />
                                    <span className="sr-only">View Logs</span>
                                  </Button>

                                  {onContainerSelect && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewDetails(container);
                                      }}
                                      title="View Details"
                                    >
                                      <Info className="h-4 w-4" />
                                      <span className="sr-only">Details</span>
                                    </Button>
                                  )}

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveContainer(container.id);
                                    }}
                                    title="Remove Container"
                                  >
                                    <Trash className="h-4 w-4" />
                                    <span className="sr-only">Remove</span>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </React.Fragment>
                    );
                  })}

                  {/* Render standalone containers */}
                  {standaloneContainers.map((container) => (
                    <TableRow
                      key={container.id}
                      className={
                        affectedContainers.has(container.id)
                          ? "bg-primary/10 transition-colors duration-500"
                          : ""
                      }
                    >
                      <TableCell className="font-medium">
                        {container.names[0] || "Unnamed"}
                      </TableCell>
                      <TableCell>{container.image}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            container.state === "running"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {container.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {container.state === "running" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStopContainer(container.id)}
                              title="Stop Container"
                            >
                              <Square className="h-4 w-4" />
                              <span className="sr-only">Stop</span>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartContainer(container.id)}
                              title="Start Container"
                            >
                              <Play className="h-4 w-4" />
                              <span className="sr-only">Start</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleViewLogs(
                                container.id,
                                container.names[0] ||
                                  container.id.substring(0, 12)
                              )
                            }
                            title="View Logs"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">View Logs</span>
                          </Button>

                          {onContainerSelect && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(container)}
                              title="View Details"
                            >
                              <Info className="h-4 w-4" />
                              <span className="sr-only">Details</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveContainer(container.id)}
                            title="Remove Container"
                          >
                            <Trash className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedContainer && (
        <ContainerLogs
          containerId={selectedContainer.id}
          containerName={selectedContainer.name}
          onClose={handleCloseLogs}
        />
      )}
    </div>
  );
};

export default ContainerList;
