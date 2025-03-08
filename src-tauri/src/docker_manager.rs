use bollard::Docker;
use once_cell::sync::Lazy;
use std::sync::Mutex;

// Global Docker client instance
static DOCKER_CLIENT: Lazy<Mutex<Option<Docker>>> = Lazy::new(|| Mutex::new(None));

// Docker connection status
#[derive(Debug, Clone, serde::Serialize)]
pub enum DockerStatus {
    Connected,
    Disconnected,
    Error(String),
}

// Initialize the Docker client
pub fn initialize_docker() -> DockerStatus {
    let mut docker_client = DOCKER_CLIENT.lock().unwrap();

    if docker_client.is_some() {
        return DockerStatus::Connected;
    }

    match Docker::connect_with_local_defaults() {
        Ok(client) => {
            *docker_client = Some(client);
            DockerStatus::Connected
        }
        Err(e) => DockerStatus::Error(format!("Failed to connect to Docker: {}", e)),
    }
}

// Get a reference to the Docker client
pub fn get_docker_client() -> Result<Docker, String> {
    let docker_client = DOCKER_CLIENT.lock().unwrap();

    match &*docker_client {
        Some(client) => Ok(client.clone()),
        None => {
            drop(docker_client); // Release the lock before initializing
            match initialize_docker() {
                DockerStatus::Connected => {
                    // Try again after initialization
                    let docker_client = DOCKER_CLIENT.lock().unwrap();
                    match &*docker_client {
                        Some(client) => Ok(client.clone()),
                        None => Err("Failed to get Docker client after initialization".to_string()),
                    }
                }
                DockerStatus::Error(e) => Err(e),
                _ => Err("Failed to initialize Docker client".to_string()),
            }
        }
    }
}

// Check if Docker is running
pub async fn check_docker_status() -> DockerStatus {
    match get_docker_client() {
        Ok(docker) => match docker.ping().await {
            Ok(_) => DockerStatus::Connected,
            Err(e) => DockerStatus::Error(format!("Docker is not responding: {}", e)),
        },
        Err(e) => DockerStatus::Error(e),
    }
}

// Reset the Docker client (useful for reconnecting)
pub fn reset_docker_client() -> DockerStatus {
    let mut docker_client = DOCKER_CLIENT.lock().unwrap();
    *docker_client = None;
    drop(docker_client);
    initialize_docker()
}
