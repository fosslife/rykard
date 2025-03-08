import React, { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, RefreshCw, TerminalSquare } from "lucide-react";

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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-6xl h-[80vh] flex flex-col"
        >
          <Card className="w-full h-full flex flex-col overflow-hidden border-border shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
              <div className="flex items-center gap-2">
                <TerminalSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Logs: {containerName}</CardTitle>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="tail-lines"
                    className="text-sm whitespace-nowrap"
                  >
                    Tail lines:
                  </label>
                  <Select
                    value={tailLines.toString()}
                    onValueChange={(value: string) =>
                      setTailLines(Number(value))
                    }
                  >
                    <SelectTrigger className="w-[80px] h-8">
                      <SelectValue placeholder="100" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                      <SelectItem value="1000">1000</SelectItem>
                      <SelectItem value="5000">5000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-refresh"
                    checked={autoRefresh}
                    onCheckedChange={(checked: boolean | "indeterminate") =>
                      setAutoRefresh(checked === true)
                    }
                  />
                  <label
                    htmlFor="auto-refresh"
                    className="text-sm cursor-pointer whitespace-nowrap"
                  >
                    Auto-refresh
                  </label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchLogs}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only md:not-sr-only md:inline-block">
                    Refresh
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only md:not-sr-only md:inline-block">
                    Close
                  </span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <div className="h-full overflow-auto p-4 bg-muted/20">
                {loading && logs === "" ? (
                  <div className="flex flex-col justify-center items-center h-full gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
                    />
                    <p className="text-muted-foreground">Loading logs...</p>
                  </div>
                ) : error ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-md"
                  >
                    {error}
                  </motion.div>
                ) : logs.trim() === "" ? (
                  <div className="flex flex-col justify-center items-center h-full gap-2">
                    <TerminalSquare className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No logs available</p>
                  </div>
                ) : (
                  <pre className="font-mono text-sm whitespace-pre-wrap bg-card p-4 rounded-md border border-border shadow-sm h-full">
                    {logs}
                  </pre>
                )}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ContainerLogs;
