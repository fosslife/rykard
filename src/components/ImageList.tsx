import React, { useEffect, useState, ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Trash, Download } from "lucide-react";
import { useDockerEvents } from "@/lib/docker-events-context";
import { DockerEvent, isImageEvent } from "@/lib/docker-events";
import { format } from "timeago.js";

interface ImageInfo {
  id: string;
  repo_tags: string[];
  size: number;
  created: number;
}

interface ImageListProps {
  images: ImageInfo[];
  loading: boolean;
  lastRefreshed: Date;
  onRefresh: () => Promise<void>;
}

const ImageList: React.FC<ImageListProps> = ({
  images,
  loading,
  lastRefreshed,
  onRefresh,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [pullImageName, setPullImageName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [affectedImages, setAffectedImages] = useState<Set<string>>(new Set());

  // Get Docker events
  const { addEventHandler, removeEventHandler } = useDockerEvents();

  // Handle Docker events for images
  useEffect(() => {
    const handleImageEvent = (event: DockerEvent) => {
      if (isImageEvent(event)) {
        // Highlight the affected image
        const imageId = event.Actor.ID;
        setAffectedImages((prev) => {
          const newSet = new Set(prev);
          newSet.add(imageId);

          // Remove the highlight after 2 seconds
          setTimeout(() => {
            setAffectedImages((prev) => {
              const newSet = new Set(prev);
              newSet.delete(imageId);
              return newSet;
            });
          }, 2000);

          return newSet;
        });
      }
    };

    addEventHandler(handleImageEvent);

    return () => {
      removeEventHandler(handleImageEvent);
    };
  }, [addEventHandler, removeEventHandler]);

  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Format timestamp to human-readable relative time
  const formatDate = (timestamp: number): string => {
    if (!timestamp) return "Unknown";

    const date = new Date(timestamp * 1000);
    return format(date); // This will return strings like "5 minutes ago"
  };

  // Format the last refreshed time
  const formatLastRefreshed = () => {
    return `Last refreshed: ${format(
      lastRefreshed
    )} (${lastRefreshed.toLocaleTimeString()})`;
  };

  const handlePullImage = async () => {
    if (!pullImageName.trim()) {
      setError("Please enter an image name");

      return;
    }

    try {
      setIsPulling(true);
      setError(null);
      await invoke("pull_image", { imageName: pullImageName });
      setPullImageName("");
      onRefresh();
    } catch (err) {
      console.error("Failed to pull image:", err);
      setError(`Failed to pull image: ${err}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    try {
      setError(null);
      await invoke("remove_image", { imageId });
      onRefresh();
    } catch (err) {
      console.error("Failed to remove image:", err);
      setError(`Failed to remove image: ${err}`);
    }
  };

  return (
    <div className="container mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Images</h1>
          <p className="text-muted-foreground">Manage your Docker images</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {formatLastRefreshed()}
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

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Pull Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <Input
                placeholder="Image name (e.g., nginx:latest)"
                value={pullImageName}
                onChange={(e) => setPullImageName(e.target.value)}
                disabled={isPulling}
              />
              <Button
                onClick={handlePullImage}
                disabled={!pullImageName.trim() || isPulling}
              >
                {isPulling ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Pulling...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Pull
                  </>
                )}
              </Button>
            </div>
            {error && (
              <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-md">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Image List</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && images.length === 0 ? (
              <div className="flex justify-center items-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No images found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repository</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {images.map((image, index) => {
                      const tag = image.repo_tags[0] || "<none>:<none>";
                      const [repo, tagName] = tag.split(":");

                      return (
                        <TableRow
                          key={`${image.id}-${index}`}
                          className={
                            affectedImages.has(image.id)
                              ? "bg-primary/10 transition-colors duration-500"
                              : ""
                          }
                        >
                          <TableCell className="font-medium">{repo}</TableCell>
                          <TableCell>{tagName}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {image.id.substring(0, 12)}
                          </TableCell>
                          <TableCell>{formatBytes(image.size)}</TableCell>
                          <TableCell>{formatDate(image.created)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveImage(image.id)}
                              title="Remove Image"
                            >
                              <Trash className="h-4 w-4" />
                              <span className="sr-only">Remove</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImageList;
