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

  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Format timestamp to human-readable date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-2xl font-bold">Images</CardTitle>
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
        <div className="mb-6 p-4 bg-card border border-border rounded-md">
          <h3 className="text-lg font-medium mb-2">Pull Image</h3>
          <div className="flex gap-2">
            <Input
              value={pullImageName}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPullImageName(e.target.value)
              }
              placeholder="Enter image name (e.g., nginx:latest)"
              className="flex-1"
            />
            <Button
              onClick={handlePullImage}
              disabled={isPulling}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              {isPulling ? "Pulling..." : "Pull"}
            </Button>
          </div>
        </div>

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
        ) : images.length === 0 ? (
          <div className="bg-muted/50 p-6 rounded-lg border border-border">
            <p className="text-center text-muted-foreground">No images found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Image ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {images
                  .map((image) => {
                    // Handle images with no tags
                    const tags =
                      image.repo_tags.length > 0 &&
                      image.repo_tags[0] !== "<none>:<none>"
                        ? image.repo_tags
                        : ["<none>:<none>"];

                    return tags.map((tag, index) => {
                      const [repo, tagName] = tag.split(":");

                      return (
                        <TableRow
                          key={`${image.id}-${index}`}
                          className="group"
                        >
                          <TableCell className="font-medium">{repo}</TableCell>
                          <TableCell>{tagName}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {image.id.substring(7, 19)}
                          </TableCell>
                          <TableCell>{formatDate(image.created)}</TableCell>
                          <TableCell>{formatBytes(image.size)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveImage(image.id)}
                            >
                              <Trash className="h-4 w-4" />
                              <span className="sr-only">Remove</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })
                  .flat()}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImageList;
