// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use bollard::container::Config as BollardConfig; // Add import for Config
use bollard::container::CreateContainerOptions as BollardCreateOptions; // Add import for CreateContainerOptions
use bollard::container::{
    ListContainersOptions, StartContainerOptions, Stats, StopContainerOptions,
};
use bollard::Docker;
use chrono::{NaiveDateTime, Utc};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;
use tauri::{Emitter, Manager, State, Window};
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerInfo {
    id: String,
    names: Vec<String>,
    image: String,
    state: String,
    status: String,
    labels: HashMap<String, String>,
    ports: Vec<PortInfo>,
    created: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PortInfo {
    ip: String,
    private_port: u16,
    public_port: u16,
    type_: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageInfo {
    id: String,
    repo_tags: Vec<String>,
    size: u64,
    created: u64,
}

#[derive(Debug, Clone, Serialize)]
pub enum DockerStatus {
    Connected,
    Disconnected,
    Error(String),
}

/// Structured error type for Docker operations
#[derive(Debug, Clone, Serialize)]
pub enum DockerError {
    ConnectionError(String),
    OperationError(String),
    NotFound(String),
    PermissionDenied(String),
    Unknown(String),
}

impl std::fmt::Display for DockerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DockerError::ConnectionError(msg) => write!(f, "Connection error: {}", msg),
            DockerError::OperationError(msg) => write!(f, "Operation error: {}", msg),
            DockerError::NotFound(msg) => write!(f, "Not found: {}", msg),
            DockerError::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
            DockerError::Unknown(msg) => write!(f, "Unknown error: {}", msg),
        }
    }
}

impl From<bollard::errors::Error> for DockerError {
    fn from(err: bollard::errors::Error) -> Self {
        match err {
            bollard::errors::Error::DockerResponseServerError {
                status_code,
                message,
            } => match status_code {
                404 => DockerError::NotFound(message),
                403 => DockerError::PermissionDenied(message),
                _ => DockerError::OperationError(format!(
                    "Server error ({}): {}",
                    status_code, message
                )),
            },
            err => {
                if err.to_string().contains("connection") {
                    DockerError::ConnectionError(err.to_string())
                } else {
                    DockerError::Unknown(err.to_string())
                }
            }
        }
    }
}

impl From<std::io::Error> for DockerError {
    fn from(err: std::io::Error) -> Self {
        DockerError::OperationError(err.to_string())
    }
}

// Type alias for results with DockerError
type DockerResult<T> = Result<T, DockerError>;

// Convert DockerResult to Result<T, String> for Tauri commands
fn to_string_error<T>(result: DockerResult<T>) -> Result<T, String> {
    result.map_err(|e| e.to_string())
}

pub struct DockerState {
    client: Option<Docker>,
    status: DockerStatus,
}

impl Default for DockerState {
    fn default() -> Self {
        Self {
            client: None,
            status: DockerStatus::Disconnected,
        }
    }
}

impl DockerState {
    pub fn initialize(&mut self) -> DockerStatus {
        if self.client.is_some() {
            return self.status.clone();
        }

        match Docker::connect_with_local_defaults() {
            Ok(client) => {
                self.client = Some(client);
                self.status = DockerStatus::Connected;
                self.status.clone()
            }
            Err(e) => {
                self.status = DockerStatus::Error(format!("Failed to connect to Docker: {}", e));
                self.status.clone()
            }
        }
    }

    pub fn get_client(&self) -> DockerResult<Docker> {
        match &self.client {
            Some(client) => Ok(client.clone()),
            None => Err(DockerError::ConnectionError(
                "Docker client not initialized".to_string(),
            )),
        }
    }

    pub async fn check_status(&mut self) -> DockerStatus {
        if let Some(client) = &self.client {
            match client.ping().await {
                Ok(_) => {
                    self.status = DockerStatus::Connected;
                }
                Err(e) => {
                    self.status = DockerStatus::Error(format!("Docker is not responding: {}", e));
                }
            }
        } else {
            // Try to initialize if not already initialized
            self.initialize();
        }

        self.status.clone()
    }

    pub fn reset(&mut self) -> DockerStatus {
        self.client = None;
        self.status = DockerStatus::Disconnected;
        self.initialize()
    }
}

// Define a type alias for our state to make it easier to use
type DockerStateManager = Arc<Mutex<DockerState>>;

#[tauri::command]
async fn initialize_docker_client(
    state: State<'_, DockerStateManager>,
) -> Result<DockerStatus, String> {
    let mut docker_state = state.lock().await;
    Ok(docker_state.initialize())
}

#[tauri::command]
async fn get_docker_status(state: State<'_, DockerStateManager>) -> Result<DockerStatus, String> {
    let mut docker_state = state.lock().await;
    Ok(docker_state.check_status().await)
}

#[tauri::command]
async fn list_containers(
    state: State<'_, DockerStateManager>,
) -> Result<Vec<ContainerInfo>, String> {
    // Get the Docker client first, then release the lock before the await
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    let options = Some(ListContainersOptions::<String> {
        all: true,
        ..Default::default()
    });

    // Use our new error handling
    match docker.list_containers(options).await {
        Ok(containers) => {
            let container_info = containers
                .iter()
                .map(|container| {
                    let names = container
                        .names
                        .clone()
                        .unwrap_or_default()
                        .iter()
                        .map(|name| name.trim_start_matches('/').to_string())
                        .collect();

                    // Extract labels
                    let labels = container
                        .labels
                        .clone()
                        .unwrap_or_default()
                        .into_iter()
                        .collect();

                    // Extract ports
                    let ports = container
                        .ports
                        .clone()
                        .unwrap_or_default()
                        .into_iter()
                        .map(|port| {
                            let port_type = match &port.typ {
                                Some(t) => format!("{}", t),
                                None => "tcp".to_string(),
                            };

                            PortInfo {
                                ip: port.ip.unwrap_or_default(),
                                private_port: port.private_port,
                                public_port: port.public_port.unwrap_or_default(),
                                type_: port_type,
                            }
                        })
                        .collect();

                    ContainerInfo {
                        id: container.id.clone().unwrap_or_default(),
                        names,
                        image: container.image.clone().unwrap_or_default(),
                        state: container.state.clone().unwrap_or_default(),
                        status: container.status.clone().unwrap_or_default(),
                        labels,
                        ports,
                        created: container.created.unwrap_or_default() as u64,
                    }
                })
                .collect();

            Ok(container_info)
        }
        Err(e) => Err(DockerError::from(e).to_string()),
    }
}

#[tauri::command]
async fn list_images(state: State<'_, DockerStateManager>) -> Result<Vec<ImageInfo>, String> {
    // Get the Docker client
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    // Use Bollard's list_images API
    let options = Some(bollard::image::ListImagesOptions::<String> {
        all: false, // Only show available images
        ..Default::default()
    });

    match docker.list_images(options).await {
        Ok(images) => {
            let image_info = images
                .iter()
                .map(|image| {
                    // Extract repo tags
                    let repo_tags = image.repo_tags.clone();

                    // Extract image ID (remove "sha256:" prefix if present)
                    let id = image.id.trim_start_matches("sha256:").to_string();

                    // Extract size and created timestamp
                    let size = image.size as u64;
                    let created = image.created as u64;

                    ImageInfo {
                        id,
                        repo_tags,
                        size,
                        created,
                    }
                })
                .collect();

            Ok(image_info)
        }
        Err(e) => Err(DockerError::from(e).to_string()),
    }
}

#[tauri::command]
async fn start_container(
    container_id: &str,
    state: State<'_, DockerStateManager>,
) -> Result<(), String> {
    // Get the Docker client first, then release the lock before the await
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    match docker
        .start_container(container_id, None::<StartContainerOptions<String>>)
        .await
    {
        Ok(_) => Ok(()),
        Err(e) => Err(DockerError::from(e).to_string()),
    }
}

#[tauri::command]
async fn stop_container(
    container_id: &str,
    state: State<'_, DockerStateManager>,
) -> Result<(), String> {
    // Get the Docker client first, then release the lock before the await
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    match docker
        .stop_container(container_id, None::<StopContainerOptions>)
        .await
    {
        Ok(_) => Ok(()),
        Err(e) => Err(DockerError::from(e).to_string()),
    }
}

#[tauri::command]
async fn remove_container(
    container_id: &str,
    state: State<'_, DockerStateManager>,
) -> Result<(), String> {
    // Get the Docker client first, then release the lock before the await
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    match docker.remove_container(container_id, None).await {
        Ok(_) => Ok(()),
        Err(e) => Err(DockerError::from(e).to_string()),
    }
}

#[tauri::command]
async fn pull_image(image_name: &str, state: State<'_, DockerStateManager>) -> Result<(), String> {
    // Get the Docker client first, then release the lock before the await
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    // Split the image name into repository and tag
    let parts: Vec<&str> = image_name.split(':').collect();
    let repository = parts[0];
    let tag = if parts.len() > 1 { parts[1] } else { "latest" };

    // Create image returns a Stream, not a Future, so we need to collect the results
    let create_image_options = bollard::image::CreateImageOptions {
        from_image: repository,
        tag,
        ..Default::default()
    };

    // Create a stream of pull progress events
    let pull_stream = docker.create_image(Some(create_image_options), None, None);

    // Collect all events from the stream
    let mut result = Ok(());

    tokio::pin!(pull_stream);

    while let Some(pull_result) = pull_stream.next().await {
        if let Err(e) = pull_result {
            result = Err(DockerError::OperationError(format!(
                "Failed to pull image: {}",
                e
            )));
            break;
        }
    }

    result.map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_image(image_id: &str, state: State<'_, DockerStateManager>) -> Result<(), String> {
    // Get the Docker client first, then release the lock before the await
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    match docker.remove_image(image_id, None, None).await {
        Ok(_) => Ok(()),
        Err(e) => Err(DockerError::from(e).to_string()),
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_container_logs(container_id: &str, tail_lines: Option<u64>) -> Result<String, String> {
    // Use a simpler approach with a command execution
    let tail = tail_lines.unwrap_or(100);

    // Use std::process::Command to run the docker logs command
    let output = Command::new("docker")
        .args(&["logs", "--tail", &tail.to_string(), container_id])
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let logs = String::from_utf8_lossy(&output.stdout).to_string();

                return Ok(logs);
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();

                return Err(format!("Failed to get logs: {}", error));
            }
        }
        Err(e) => Err(format!("Failed to execute command: {}", e)),
    }
}

// --- Start: Add create_container command ---

/// Options for creating a new container, received from the frontend
#[derive(Debug, Deserialize)]
struct CreateContainerOptions {
    image: String,
    name: String,
    // TODO: Add ports, volumes, env vars later
}

#[tauri::command]
async fn create_container(
    options: CreateContainerOptions,
    state: State<'_, DockerStateManager>,
) -> Result<(), String> {
    // Get the Docker client
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    // Prepare Bollard's CreateContainerOptions and Config
    let config = BollardConfig {
        image: Some(options.image.clone()),
        // TODO: Add HostConfig for ports, volumes etc.
        ..Default::default()
    };

    let create_options = Some(BollardCreateOptions {
        name: options.name.clone(),
        platform: None, // Specifying platform for broader compatibility
    });

    // Call Bollard's create_container
    match docker.create_container(create_options, config).await {
        Ok(response) => {
            println!("Container created successfully: ID {}", response.id);
            // Attempt to start the container
            match docker
                .start_container(&response.id, None::<StartContainerOptions<String>>)
                .await
            {
                Ok(_) => {
                    println!("Container started successfully: ID {}", response.id);
                    Ok(())
                }
                Err(e) => {
                    eprintln!(
                        "Container {} created, but failed to start: {}",
                        response.id, e
                    );
                    // Even if starting fails, creation was successful, so we could argue about the return.
                    // For now, let's return an error that it failed to start.
                    Err(format!(
                        "Container created (ID: {}), but failed to start: {}",
                        response.id,
                        DockerError::from(e).to_string()
                    ))
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to create container: {}", e);
            Err(DockerError::from(e).to_string())
        }
    }
}

// --- End: Add create_container command ---

/// Subscribe to Docker events and forward them to the frontend
/// This replaces polling with real-time event notifications
#[tauri::command]
async fn subscribe_to_docker_events(
    window: Window,
    state: State<'_, DockerStateManager>,
) -> Result<(), String> {
    // Get the Docker client first, then release the lock before the await
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    // Create a stream of Docker events
    let events = docker.events(None::<bollard::system::EventsOptions<String>>);

    // Spawn a task to process events
    tokio::spawn(async move {
        tokio::pin!(events);

        while let Some(event_result) = events.next().await {
            match event_result {
                Ok(event) => {
                    // Convert event to a format suitable for the frontend
                    if let Ok(event_json) = serde_json::to_string(&event) {
                        // Emit the event to the frontend
                        let _ = window.emit("docker-event", event_json);
                    }
                }
                Err(e) => {
                    eprintln!("Error receiving Docker event: {}", e);
                    // Try to emit error to frontend
                    let _ = window.emit("docker-event-error", format!("Error: {}", e));
                }
            }
        }
    });

    Ok(())
}

/// Pull an image with progress reporting to the frontend
#[tauri::command]
async fn pull_image_with_progress(
    image_name: &str,
    window: Window,
    state: State<'_, DockerStateManager>,
) -> Result<(), String> {
    // Get the Docker client first, then release the lock before the await
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    // Split the image name into repository and tag
    let parts: Vec<&str> = image_name.split(':').collect();
    let repository = parts[0];
    let tag = if parts.len() > 1 { parts[1] } else { "latest" };

    // Create image returns a Stream, not a Future, so we need to collect the results
    let create_image_options = bollard::image::CreateImageOptions {
        from_image: repository,
        tag,
        ..Default::default()
    };

    // Create a stream of pull progress events
    let pull_stream = docker.create_image(Some(create_image_options), None, None);

    tokio::pin!(pull_stream);

    while let Some(pull_result) = pull_stream.next().await {
        match pull_result {
            Ok(progress) => {
                // Emit progress event to frontend
                if let Ok(progress_json) = serde_json::to_string(&progress) {
                    let _ = window.emit("pull-progress", progress_json);
                }
            }
            Err(e) => {
                return Err(
                    DockerError::OperationError(format!("Failed to pull image: {}", e)).to_string(),
                );
            }
        }
    }

    Ok(())
}

// Helper function to parse human-readable size to bytes
fn parse_size(size_str: &str) -> u64 {
    if size_str.is_empty() {
        return 0;
    }

    let size_str = size_str.trim();
    let mut numeric_part = String::new();
    let mut unit_part = String::new();

    for c in size_str.chars() {
        if c.is_digit(10) || c == '.' {
            numeric_part.push(c);
        } else if !c.is_whitespace() {
            unit_part.push(c);
        }
    }

    let numeric_value: f64 = numeric_part.parse().unwrap_or(0.0);

    match unit_part.to_uppercase().as_str() {
        "B" => numeric_value as u64,
        "KB" | "K" => (numeric_value * 1_024.0) as u64,
        "MB" | "M" => (numeric_value * 1_024.0 * 1_024.0) as u64,
        "GB" | "G" => (numeric_value * 1_024.0 * 1_024.0 * 1_024.0) as u64,
        "TB" | "T" => (numeric_value * 1_024.0 * 1_024.0 * 1_024.0 * 1_024.0) as u64,
        _ => numeric_value as u64,
    }
}

// Helper function to parse timestamp to Unix timestamp
fn parse_timestamp(timestamp_str: &str) -> u64 {
    // Docker timestamps can be in different formats
    // Try a few common formats
    let formats = [
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S",
        "%a %b %d %H:%M:%S %Y",
        "%Y-%m-%dT%H:%M:%S",
    ];

    for format in formats {
        if let Ok(dt) = NaiveDateTime::parse_from_str(timestamp_str, format) {
            // Use the non-deprecated approach
            return dt.and_utc().timestamp() as u64;
        }
    }

    // Fallback to current time if parsing fails
    Utc::now().timestamp() as u64
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerStats {
    cpu_usage_percent: f64,
    memory_usage: u64,
    memory_limit: u64,
    memory_usage_percent: f64,
    network_rx_bytes: u64,
    network_tx_bytes: u64,
    block_read_bytes: u64,
    block_write_bytes: u64,
}

/// Get container stats (CPU, memory, network)
#[tauri::command]
async fn get_container_stats(
    container_id: &str,
    state: State<'_, DockerStateManager>,
) -> Result<ContainerStats, String> {
    // Get the Docker client
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    // Use Bollard's stats API to get container stats
    // We need to create a stream and get the first result
    let stats_options = bollard::container::StatsOptions {
        stream: false, // We only want one stats snapshot
        ..Default::default()
    };

    let mut stats_stream = docker.stats(container_id, Some(stats_options));

    // Get the first (and only) stats result
    match stats_stream.next().await {
        Some(Ok(stats)) => {
            // Calculate CPU usage percentage
            let cpu_usage_percent = calculate_cpu_percentage(&stats);

            // Get memory usage and limit
            let memory_usage = match &stats.memory_stats.usage {
                Some(usage) => *usage,
                None => 0,
            };

            let memory_limit = match &stats.memory_stats.limit {
                Some(limit) => *limit,
                None => 0,
            };

            // Calculate memory usage percentage
            let memory_usage_percent = if memory_limit > 0 {
                (memory_usage as f64 / memory_limit as f64) * 100.0
            } else {
                0.0
            };

            // Get network I/O
            let (network_rx_bytes, network_tx_bytes) = get_network_stats(&stats);

            // Get block I/O
            let (block_read_bytes, block_write_bytes) = get_block_io_stats(&stats);

            Ok(ContainerStats {
                cpu_usage_percent,
                memory_usage,
                memory_limit,
                memory_usage_percent,
                network_rx_bytes,
                network_tx_bytes,
                block_read_bytes,
                block_write_bytes,
            })
        }
        Some(Err(e)) => Err(DockerError::from(e).to_string()),
        None => Err(DockerError::NotFound(format!(
            "No stats found for container {}",
            container_id
        ))
        .to_string()),
    }
}

/// Calculate CPU usage percentage from stats
fn calculate_cpu_percentage(stats: &Stats) -> f64 {
    // Extract CPU usage data
    let cpu_usage = stats.cpu_stats.cpu_usage.total_usage;
    let precpu_usage = stats.precpu_stats.cpu_usage.total_usage;
    let cpu_delta = if cpu_usage > precpu_usage {
        (cpu_usage - precpu_usage) as i64
    } else {
        0
    };

    let system_cpu_usage = match stats.cpu_stats.system_cpu_usage {
        Some(usage) => usage,
        None => 0,
    };

    let system_precpu_usage = match stats.precpu_stats.system_cpu_usage {
        Some(usage) => usage,
        None => 0,
    };

    let system_delta = if system_cpu_usage > system_precpu_usage {
        (system_cpu_usage - system_precpu_usage) as i64
    } else {
        0
    };

    let online_cpus = match stats.cpu_stats.online_cpus {
        Some(cpus) => cpus as f64,
        None => 1.0,
    };

    // Calculate percentage
    if system_delta > 0 && cpu_delta > 0 {
        ((cpu_delta as f64 / system_delta as f64) * online_cpus) * 100.0
    } else {
        0.0
    }
}

/// Extract network stats from container stats
fn get_network_stats(stats: &Stats) -> (u64, u64) {
    if let Some(networks) = &stats.networks {
        let mut rx_bytes = 0;
        let mut tx_bytes = 0;

        for (_interface, network) in networks {
            rx_bytes += network.rx_bytes;
            tx_bytes += network.tx_bytes;
        }

        (rx_bytes, tx_bytes)
    } else {
        (0, 0)
    }
}

/// Extract block I/O stats from container stats
fn get_block_io_stats(stats: &Stats) -> (u64, u64) {
    let blkio_stats = &stats.blkio_stats;

    if let Some(io_service_bytes_recursive) = &blkio_stats.io_service_bytes_recursive {
        let mut read_bytes = 0;
        let mut write_bytes = 0;

        for stat in io_service_bytes_recursive {
            // op is a String, not an Option<String>
            if stat.op == "Read" {
                read_bytes += stat.value;
            } else if stat.op == "Write" {
                write_bytes += stat.value;
            }
        }

        return (read_bytes, write_bytes);
    }

    (0, 0)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PortMapping {
    host_ip: String,
    host_port: String,
    container_port: String,
    protocol: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VolumeMapping {
    host_path: String,
    container_path: String,
    mode: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerConfig {
    id: String,
    name: String,
    image: String,
    command: String,
    created: String,
    status: String,
    ports: Vec<PortMapping>,
    volumes: Vec<VolumeMapping>,
    env_vars: Vec<String>,
    labels: HashMap<String, String>,
    network_mode: String,
    restart_policy: String,
}

/// Get detailed container configuration
#[tauri::command]
async fn get_container_config(
    container_id: &str,
    state: State<'_, DockerStateManager>,
) -> Result<ContainerConfig, String> {
    // Get the Docker client first, then release the lock before the await
    let docker = {
        let docker_state = state.lock().await;
        match docker_state.get_client() {
            Ok(client) => client,
            Err(e) => return Err(e.to_string()),
        }
    };

    // Inspect the container to get its configuration
    match docker.inspect_container(container_id, None).await {
        Ok(details) => {
            // Extract container name (remove leading slash)
            let name = details
                .name
                .unwrap_or_default()
                .trim_start_matches('/')
                .to_string();

            // Extract image name
            let image = details
                .config
                .as_ref()
                .and_then(|config| config.image.clone())
                .unwrap_or_default();

            // Extract command
            let command = details
                .config
                .as_ref()
                .and_then(|config| config.cmd.clone())
                .map(|cmd| cmd.join(" "))
                .unwrap_or_default();

            // Extract created time
            let created = details.created.unwrap_or_default();

            // Extract status - fix the Default trait issue
            let status = details
                .state
                .as_ref()
                .and_then(|state| state.status.clone())
                .map(|s| s.to_string())
                .unwrap_or_else(|| "unknown".to_string());

            // Extract port mappings
            let mut ports = Vec::new();
            if let Some(network_settings) = details.network_settings {
                if let Some(port_map) = network_settings.ports {
                    for (container_port, host_bindings) in port_map {
                        if let Some(bindings) = host_bindings {
                            for binding in bindings {
                                let parts: Vec<&str> = container_port.split('/').collect();
                                let port_number = parts.get(0).unwrap_or(&"");
                                let protocol = parts.get(1).unwrap_or(&"tcp");

                                ports.push(PortMapping {
                                    host_ip: binding.host_ip.unwrap_or_default(),
                                    host_port: binding.host_port.unwrap_or_default(),
                                    container_port: port_number.to_string(),
                                    protocol: protocol.to_string(),
                                });
                            }
                        }
                    }
                }
            }

            // Extract volume mappings
            let mut volumes = Vec::new();
            if let Some(mounts) = details.mounts {
                for mount in mounts {
                    volumes.push(VolumeMapping {
                        host_path: mount.source.unwrap_or_default(),
                        container_path: mount.destination.unwrap_or_default(),
                        mode: mount.mode.unwrap_or_default(),
                    });
                }
            }

            // Extract environment variables
            let env_vars = details
                .config
                .as_ref()
                .and_then(|config| config.env.clone())
                .unwrap_or_default();

            // Extract labels
            let labels = details
                .config
                .as_ref()
                .and_then(|config| config.labels.clone())
                .unwrap_or_default();

            // Extract network mode
            let network_mode = details
                .host_config
                .as_ref()
                .and_then(|config| config.network_mode.clone())
                .unwrap_or_default();

            // Extract restart policy - fix the Default trait issue
            let restart_policy = details
                .host_config
                .as_ref()
                .and_then(|config| config.restart_policy.as_ref())
                .and_then(|policy| policy.name.clone())
                .map(|name| name.to_string())
                .unwrap_or_else(|| "no".to_string());

            Ok(ContainerConfig {
                id: container_id.to_string(),
                name,
                image,
                command,
                created,
                status,
                ports,
                volumes,
                env_vars,
                labels,
                network_mode,
                restart_policy,
            })
        }
        Err(e) => Err(DockerError::from(e).to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            // Initialize Docker state with tokio Mutex
            app.manage(Arc::new(Mutex::new(DockerState::default())));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            list_containers,
            list_images,
            start_container,
            stop_container,
            remove_container,
            pull_image,
            pull_image_with_progress,
            remove_image,
            get_container_logs,
            get_container_stats,
            get_container_config,
            initialize_docker_client,
            get_docker_status,
            subscribe_to_docker_events,
            create_container // Register the new command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
