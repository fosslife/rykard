import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

// Define Docker event types
export interface DockerEvent {
  Type: "container" | "image" | "volume" | "network" | "daemon" | string;
  Action: string;
  Actor: {
    ID: string;
    Attributes: Record<string, string>;
  };
  scope: string;
  time: number;
  timeNano: number;
}

// Define event handlers
export type DockerEventHandler = (event: DockerEvent) => void;
export type DockerErrorHandler = (error: string) => void;

// Event listeners
let eventUnlisten: (() => void) | null = null;
let errorUnlisten: (() => void) | null = null;

// Event handlers
const eventHandlers: DockerEventHandler[] = [];
const errorHandlers: DockerErrorHandler[] = [];

// Debounce function to avoid excessive updates
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);
  };
}

// Initialize Docker events
export async function initializeDockerEvents(): Promise<void> {
  try {
    // Subscribe to Docker events on the backend
    await invoke("subscribe_to_docker_events");

    // Listen for Docker events
    eventUnlisten = await listen<string>("docker-event", (event) => {
      try {
        const dockerEvent = JSON.parse(event.payload) as DockerEvent;

        // Notify all event handlers
        eventHandlers.forEach((handler) => handler(dockerEvent));
      } catch (error) {
        console.error("Error parsing Docker event:", error);
      }
    });

    // Listen for Docker event errors
    errorUnlisten = await listen<string>("docker-event-error", (event) => {
      // Notify all error handlers
      errorHandlers.forEach((handler) => handler(event.payload));
    });

    console.log("Docker events initialized");
  } catch (error) {
    console.error("Failed to initialize Docker events:", error);
    throw error;
  }
}

// Clean up event listeners
export function cleanupDockerEvents(): void {
  if (eventUnlisten) {
    eventUnlisten();
    eventUnlisten = null;
  }

  if (errorUnlisten) {
    errorUnlisten();
    errorUnlisten = null;
  }

  // Clear all handlers
  eventHandlers.length = 0;
  errorHandlers.length = 0;
}

// Add event handler
export function addDockerEventHandler(handler: DockerEventHandler): void {
  eventHandlers.push(handler);
}

// Remove event handler
export function removeDockerEventHandler(handler: DockerEventHandler): void {
  const index = eventHandlers.indexOf(handler);
  if (index !== -1) {
    eventHandlers.splice(index, 1);
  }
}

// Add error handler
export function addDockerErrorHandler(handler: DockerErrorHandler): void {
  errorHandlers.push(handler);
}

// Remove error handler
export function removeDockerErrorHandler(handler: DockerErrorHandler): void {
  const index = errorHandlers.indexOf(handler);
  if (index !== -1) {
    errorHandlers.splice(index, 1);
  }
}

// Helper function to check if an event is related to a specific container
export function isContainerEvent(
  event: DockerEvent,
  containerId?: string
): boolean {
  return (
    event.Type === "container" &&
    (!containerId ||
      event.Actor.ID === containerId ||
      event.Actor.Attributes.id === containerId)
  );
}

// Helper function to check if an event is related to a specific image
export function isImageEvent(event: DockerEvent, imageId?: string): boolean {
  return (
    event.Type === "image" &&
    (!imageId ||
      event.Actor.ID === imageId ||
      event.Actor.Attributes.id === imageId)
  );
}
