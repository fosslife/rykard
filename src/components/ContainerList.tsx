import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useState } from "react";
import ContainerLogs from "./ContainerLogs";

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
}

const ContainerList: React.FC = () => {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const fetchContainers = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<ContainerInfo[]>("list_containers");
      setContainers(result);
    } catch (err) {
      console.error("Failed to fetch containers:", err);
      setError("Failed to fetch containers. Make sure Docker is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  const handleStartContainer = async (containerId: string) => {
    try {
      await invoke("start_container", { containerId });
      fetchContainers();
    } catch (err) {
      console.error("Failed to start container:", err);
      setError("Failed to start container.");
    }
  };

  const handleStopContainer = async (containerId: string) => {
    try {
      await invoke("stop_container", { containerId });
      fetchContainers();
    } catch (err) {
      console.error("Failed to stop container:", err);
      setError("Failed to stop container.");
    }
  };

  const handleRemoveContainer = async (containerId: string) => {
    try {
      await invoke("remove_container", { containerId });
      fetchContainers();
    } catch (err) {
      console.error("Failed to remove container:", err);
      setError("Failed to remove container.");
    }
  };

  const handleViewLogs = (containerId: string, containerName: string) => {
    setSelectedContainer({ id: containerId, name: containerName });
  };

  const handleCloseLogs = () => {
    setSelectedContainer(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Containers</h2>
        <button
          onClick={fetchContainers}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p>Loading containers...</p>
        </div>
      ) : containers.length === 0 ? (
        <div className="bg-card p-6 rounded-lg border border-border">
          <p className="text-center text-muted-foreground">
            No containers found
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Image</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">State</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((container) => (
                <tr
                  key={container.id}
                  className="border-b border-border hover:bg-muted/50"
                >
                  <td className="px-4 py-3">
                    {container.names[0] || "Unnamed"}
                  </td>
                  <td className="px-4 py-3">{container.image}</td>
                  <td className="px-4 py-3">{container.status}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs ${
                        container.state === "running"
                          ? "bg-green-100 text-green-800"
                          : container.state === "exited"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {container.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() =>
                        handleViewLogs(
                          container.id,
                          container.names[0] || container.id.substring(0, 12)
                        )
                      }
                      className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      Logs
                    </button>
                    {container.state === "running" ? (
                      <button
                        onClick={() => handleStopContainer(container.id)}
                        className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartContainer(container.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600"
                      >
                        Start
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveContainer(container.id)}
                      className="px-3 py-1 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
