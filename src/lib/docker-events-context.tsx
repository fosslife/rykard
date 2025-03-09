import React, { createContext, useContext, useEffect, useState } from "react";
import {
  DockerEvent,
  DockerEventHandler,
  DockerErrorHandler,
  addDockerEventHandler,
  addDockerErrorHandler,
  cleanupDockerEvents,
  initializeDockerEvents,
  removeDockerEventHandler,
  removeDockerErrorHandler,
} from "./docker-events";

interface DockerEventsContextType {
  isInitialized: boolean;
  lastEvent: DockerEvent | null;
  lastError: string | null;
  addEventHandler: (handler: DockerEventHandler) => void;
  removeEventHandler: (handler: DockerEventHandler) => void;
  addErrorHandler: (handler: DockerErrorHandler) => void;
  removeErrorHandler: (handler: DockerErrorHandler) => void;
}

const DockerEventsContext = createContext<DockerEventsContextType | null>(null);

export function useDockerEvents(): DockerEventsContextType {
  const context = useContext(DockerEventsContext);

  if (!context) {
    throw new Error(
      "useDockerEvents must be used within a DockerEventsProvider"
    );
  }

  return context;
}

interface DockerEventsProviderProps {
  children: React.ReactNode;
}

export function DockerEventsProvider({ children }: DockerEventsProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastEvent, setLastEvent] = useState<DockerEvent | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Initialize Docker events
  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeDockerEvents();
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize Docker events:", error);
        setLastError(String(error));
      }
    };

    initialize();

    // Clean up on unmount
    return () => {
      cleanupDockerEvents();
    };
  }, []);

  // Set up default event and error handlers
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const eventHandler = (event: DockerEvent) => {
      setLastEvent(event);
      console.log("Docker event:", event);
    };

    const errorHandler = (error: string) => {
      setLastError(error);
      console.error("Docker event error:", error);
    };

    addDockerEventHandler(eventHandler);
    addDockerErrorHandler(errorHandler);

    return () => {
      removeDockerEventHandler(eventHandler);
      removeDockerErrorHandler(errorHandler);
    };
  }, [isInitialized]);

  const value: DockerEventsContextType = {
    isInitialized,
    lastEvent,
    lastError,
    addEventHandler: addDockerEventHandler,
    removeEventHandler: removeDockerEventHandler,
    addErrorHandler: addDockerErrorHandler,
    removeErrorHandler: removeDockerErrorHandler,
  };

  return (
    <DockerEventsContext.Provider value={value}>
      {children}
    </DockerEventsContext.Provider>
  );
}
