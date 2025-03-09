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
import { RefreshCw, Play, Square, Trash, FileText, Info } from "lucide-react";

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
}

interface ContainerListProps {
  containers: ContainerInfo[];
  loading: boolean;
  lastRefreshed: Date;
  onRefresh: () => Promise<void>;
  onContainerSelect?: (container: ContainerInfo) => void;
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-2xl font-bold">Containers</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-md"
          >
            {error}
          </motion.div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
          </div>
        ) : containers.length === 0 ? (
          <div className="bg-muted/50 p-6 rounded-lg border border-border">
            <p className="text-center text-muted-foreground">
              No containers found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers.map((container) => (
                  <TableRow key={container.id} className="group">
                    <TableCell className="font-medium">
                      {container.names[0] || "Unnamed"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {container.image}
                    </TableCell>
                    <TableCell>{container.status}</TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusBadgeVariant(container.state) as any}
                      >
                        {container.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                        </Button>

                        {container.state === "running" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStopContainer(container.id)}
                          >
                            <Square className="h-4 w-4" />
                            <span className="sr-only">Stop</span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartContainer(container.id)}
                          >
                            <Play className="h-4 w-4" />
                            <span className="sr-only">Start</span>
                          </Button>
                        )}

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveContainer(container.id)}
                        >
                          <Trash className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>

                        {onContainerSelect && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(container)}
                            title="View Details"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {selectedContainer && (
          <ContainerLogs
            containerId={selectedContainer.id}
            containerName={selectedContainer.name}
            onClose={handleCloseLogs}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ContainerList;
