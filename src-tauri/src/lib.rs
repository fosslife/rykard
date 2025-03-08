// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use bollard::container::{ListContainersOptions, StartContainerOptions, StopContainerOptions};
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

                    ContainerInfo {
                        id: container.id.clone().unwrap_or_default(),
                        names,
                        image: container.image.clone().unwrap_or_default(),
                        state: container.state.clone().unwrap_or_default(),
                        status: container.status.clone().unwrap_or_default(),
                    }
                })
                .collect();

            Ok(container_info)
        }
        Err(e) => Err(DockerError::from(e).to_string()),
    }
}

#[tauri::command]
async fn list_images(_state: State<'_, DockerStateManager>) -> Result<Vec<ImageInfo>, String> {
    // Use the docker CLI command instead of the Bollard API to avoid type issues
    let output = Command::new("docker")
        .args(&[
            "images",
            "--format",
            "{{.ID}}|{{.Repository}}:{{.Tag}}|{{.Size}}|{{.CreatedAt}}",
        ])
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout).to_string();
                let mut image_info = Vec::new();

                for line in output_str.lines() {
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() >= 4 {
                        let id = parts[0].to_string();
                        let repo_tag = parts[1].to_string();
                        let repo_tags = vec![repo_tag];

                        // Parse size (convert human-readable size to bytes)
                        let size_str = parts[2];
                        let size = parse_size(size_str);

                        // Parse created timestamp
                        let created_str = parts[3];
                        let created = parse_timestamp(created_str);

                        image_info.push(ImageInfo {
                            id,
                            repo_tags,
                            size,
                            created,
                        });
                    }
                }

                Ok(image_info)
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();

                Err(format!("Failed to list images: {}", error))
            }
        }
        Err(e) => Err(format!("Failed to execute command: {}", e)),
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
    _state: State<'_, DockerStateManager>,
) -> Result<ContainerStats, String> {
    // We don't need the Docker client for this function since we're using the CLI

    // Use the Docker CLI command for stats since Bollard's stats API is more complex to work with
    let output = Command::new("docker")
        .args(&[
            "stats",
            "--no-stream",
            "--format",
            "{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}",
            container_id,
        ])
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout).to_string();
                let lines: Vec<&str> = output_str.lines().collect();

                if lines.is_empty() {
                    return Err(DockerError::NotFound(format!(
                        "No stats found for container {}",
                        container_id
                    ))
                    .to_string());
                }

                let parts: Vec<&str> = lines[0].split('|').collect();
                if parts.len() < 5 {
                    return Err(
                        DockerError::OperationError("Invalid stats format".to_string()).to_string(),
                    );
                }

                // Parse CPU percentage (remove % sign)
                let cpu_str = parts[0].trim_end_matches('%');
                let cpu_usage_percent = cpu_str.parse::<f64>().unwrap_or(0.0);

                // Parse memory usage (format: "100MiB / 1.944GiB")
                let mem_parts: Vec<&str> = parts[1].split('/').collect();
                let memory_usage = if mem_parts.len() > 0 {
                    parse_size(mem_parts[0].trim())
                } else {
                    0
                };

                let memory_limit = if mem_parts.len() > 1 {
                    parse_size(mem_parts[1].trim())
                } else {
                    0
                };

                // Parse memory percentage (remove % sign)
                let mem_percent_str = parts[2].trim_end_matches('%');
                let memory_usage_percent = mem_percent_str.parse::<f64>().unwrap_or(0.0);

                // Parse network I/O (format: "1.45kB / 2.3MB")
                let net_parts: Vec<&str> = parts[3].split('/').collect();
                let network_rx_bytes = if net_parts.len() > 0 {
                    parse_size(net_parts[0].trim())
                } else {
                    0
                };

                let network_tx_bytes = if net_parts.len() > 1 {
                    parse_size(net_parts[1].trim())
                } else {
                    0
                };

                // Parse block I/O (format: "0B / 0B")
                let block_parts: Vec<&str> = parts[4].split('/').collect();
                let block_read_bytes = if block_parts.len() > 0 {
                    parse_size(block_parts[0].trim())
                } else {
                    0
                };

                let block_write_bytes = if block_parts.len() > 1 {
                    parse_size(block_parts[1].trim())
                } else {
                    0
                };

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
            } else {
                let error = String::from_utf8_lossy(&output.stderr).to_string();
                Err(DockerError::OperationError(format!(
                    "Failed to get container stats: {}",
                    error
                ))
                .to_string())
            }
        }
        Err(e) => Err(DockerError::from(e).to_string()),
    }
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
            subscribe_to_docker_events
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
