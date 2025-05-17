import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Corrected path
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

interface ContainerCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Callback after successful creation
  initialImageName?: string; // Optional: To pre-fill the image name
}

const ContainerCreateForm: React.FC<ContainerCreateFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialImageName,
}) => {
  const [imageName, setImageName] = useState(initialImageName || "");
  const [containerName, setContainerName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!imageName) {
      setError("Image name is required.");
      return;
    }

    // Use imageName as containerName if containerName is empty
    let finalContainerName = containerName.trim() || imageName;
    // Sanitize the container name: replace colons with underscores
    finalContainerName = finalContainerName.replace(/:/g, "_");

    console.log("Final container name:", finalContainerName);

    setIsLoading(true);
    setError(null);

    try {
      const options = {
        image: imageName,
        name: finalContainerName,
      };

      console.log("Final container name:", finalContainerName); // User added log
      console.log("Creating container with payload:", { options }); // Debug log for clarity
      await invoke("create_container", { options }); // Corrected payload
      console.log("Container creation invoked successfully."); // Debug log

      onSuccess(); // Refresh container list or show success message
      onClose(); // Close the dialog
    } catch (err: any) {
      console.error("Failed to create container:", err); // Debug log
      setError(`Failed to create container: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form state when dialog opens/closes or initialImageName changes
  React.useEffect(() => {
    if (isOpen) {
      setImageName(initialImageName || "");
      setContainerName("");
      setError(null);
      setIsLoading(false);
    } else {
      // Clear fields when closing if not already cleared by a successful submission
      setImageName("");
      setContainerName("");
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, initialImageName]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Container</DialogTitle>
          <DialogDescription>
            Configure the details for your new container. Click create when
            you're done.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image-name" className="text-right">
              Image Name*
            </Label>
            <Input
              id="image-name"
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., ubuntu:latest, nginx"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="container-name" className="text-right">
              Container Name*
            </Label>
            <Input
              id="container-name"
              value={containerName}
              onChange={(e) => setContainerName(e.target.value)}
              className="col-span-3"
              placeholder="Defaults to image name if empty"
            />
          </div>
          {/* TODO: Add fields for Ports, Volumes, Environment Variables */}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={isLoading || !imageName}>
            {isLoading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContainerCreateForm;
