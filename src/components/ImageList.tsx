import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ImageInfo {
  id: string;
  repo_tags: string[];
  size: number;
  created: number;
}

const ImageList: React.FC = () => {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullImageName, setPullImageName] = useState("");
  const [isPulling, setIsPulling] = useState(false);

  const fetchImages = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<ImageInfo[]>("list_images");
      setImages(result);
    } catch (err) {
      console.error("Failed to fetch images:", err);
      setError("Failed to fetch images. Make sure Docker is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

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
      fetchImages();
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
      fetchImages();
    } catch (err) {
      console.error("Failed to remove image:", err);
      setError(`Failed to remove image: ${err}`);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Images</h2>
        <button
          onClick={fetchImages}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 p-4 bg-card border border-border rounded-md">
        <h3 className="text-lg font-medium mb-2">Pull Image</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={pullImageName}
            onChange={(e) => setPullImageName(e.target.value)}
            placeholder="Enter image name (e.g., nginx:latest)"
            className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
          />
          <button
            onClick={handlePullImage}
            disabled={isPulling}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isPulling ? "Pulling..." : "Pull"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p>Loading images...</p>
        </div>
      ) : images.length === 0 ? (
        <div className="bg-card p-6 rounded-lg border border-border">
          <p className="text-center text-muted-foreground">No images found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="px-4 py-2 text-left">Repository</th>
                <th className="px-4 py-2 text-left">Tag</th>
                <th className="px-4 py-2 text-left">Image ID</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-left">Size</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
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
                      <tr
                        key={`${image.id}-${index}`}
                        className="border-b border-border hover:bg-muted/50"
                      >
                        <td className="px-4 py-3">{repo}</td>
                        <td className="px-4 py-3">{tagName}</td>
                        <td className="px-4 py-3">
                          {image.id.substring(7, 19)}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(image.created)}
                        </td>
                        <td className="px-4 py-3">{formatBytes(image.size)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveImage(image.id)}
                            className="px-3 py-1 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })
                .flat()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ImageList;
