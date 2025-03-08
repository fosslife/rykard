import React, { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ContainerLogsProps {
  containerId: string;
  containerName: string;
  onClose: () => void;
}

const ContainerLogs: React.FC<ContainerLogsProps> = ({
  containerId,
  containerName,
  onClose,
}) => {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [tailLines, setTailLines] = useState(100);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<number | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<string>("get_container_logs", {
        containerId,
        tailLines,
      });
      setLogs(result);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      setError(`Failed to fetch logs: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [containerId, tailLines]);

  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = window.setInterval(() => {
        fetchLogs();
      }, 2000);
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, containerId, tailLines]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg shadow-lg w-4/5 h-4/5 flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-bold">Logs: {containerName}</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="tail-lines" className="text-sm">
                Tail lines:
              </label>
              <select
                id="tail-lines"
                value={tailLines}
                onChange={(e) => setTailLines(Number(e.target.value))}
                className="px-2 py-1 border border-input rounded-md bg-background text-sm"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={5000}>5000</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto-refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-input"
              />
              <label htmlFor="auto-refresh" className="text-sm">
                Auto-refresh
              </label>
            </div>
            <button
              onClick={fetchLogs}
              className="px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 text-sm"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          {loading && logs === "" ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading logs...</p>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-md">
              {error}
            </div>
          ) : logs.trim() === "" ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">
              <p>No logs available</p>
            </div>
          ) : (
            <pre className="font-mono text-sm whitespace-pre-wrap">{logs}</pre>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default ContainerLogs;
