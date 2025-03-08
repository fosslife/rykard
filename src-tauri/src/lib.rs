// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use bollard::container::{ListContainersOptions, StartContainerOptions, StopContainerOptions};
use bollard::Docker;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tokio;

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

#[tauri::command]
async fn list_containers() -> Result<Vec<ContainerInfo>, String> {
    let docker: Docker = match Docker::connect_with_local_defaults() {
        Ok(docker) => docker,
        Err(e) => return Err(format!("Failed to connect to Docker: {}", e)),
    };

    let options = Some(ListContainersOptions::<String> {
        all: true,
        ..Default::default()
    });

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
        Err(e) => Err(format!("Failed to list images: {}", e)),
    }
}

#[tauri::command]
async fn list_images() -> Result<Vec<ImageInfo>, String> {
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

// Helper function to parse human-readable size to bytes
fn parse_size(_size_str: &str) -> u64 {
    // Simple implementation - just return 0 for now
    // In a real implementation, we would parse strings like "10MB", "1.2GB", etc.
    0
}

// Helper function to parse timestamp to Unix timestamp
fn parse_timestamp(_timestamp_str: &str) -> u64 {
    // Simple implementation - just return 0 for now
    // In a real implementation, we would parse the timestamp string
    0
}

#[tauri::command]
async fn start_container(container_id: &str) -> Result<(), String> {
    let docker = match Docker::connect_with_local_defaults() {
        Ok(docker) => docker,
        Err(e) => return Err(format!("Failed to connect to Docker: {}", e)),
    };

    match docker
        .start_container(container_id, None::<StartContainerOptions<String>>)
        .await
    {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to start container: {}", e)),
    }
}

#[tauri::command]
async fn stop_container(container_id: &str) -> Result<(), String> {
    let docker = match Docker::connect_with_local_defaults() {
        Ok(docker) => docker,
        Err(e) => return Err(format!("Failed to connect to Docker: {}", e)),
    };

    match docker
        .stop_container(container_id, None::<StopContainerOptions>)
        .await
    {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to stop container: {}", e)),
    }
}

#[tauri::command]
async fn remove_container(container_id: &str) -> Result<(), String> {
    let docker = match Docker::connect_with_local_defaults() {
        Ok(docker) => docker,
        Err(e) => return Err(format!("Failed to connect to Docker: {}", e)),
    };

    match docker.remove_container(container_id, None).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to remove container: {}", e)),
    }
}

#[tauri::command]
async fn pull_image(image_name: &str) -> Result<(), String> {
    let docker = match Docker::connect_with_local_defaults() {
        Ok(docker) => docker,
        Err(e) => return Err(format!("Failed to connect to Docker: {}", e)),
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
            result = Err(format!("Failed to pull image: {}", e));
            break;
        }
    }

    result
}

#[tauri::command]
async fn remove_image(image_id: &str) -> Result<(), String> {
    let docker = match Docker::connect_with_local_defaults() {
        Ok(docker) => docker,
        Err(e) => return Err(format!("Failed to connect to Docker: {}", e)),
    };

    match docker.remove_image(image_id, None, None).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to remove image: {}", e)),
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_container_logs(container_id: &str, tail_lines: Option<u64>) -> Result<String, String> {
    // We don't need Docker connection for this approach, so we can remove the unused variable
    // by removing this code or prefixing with underscore
    // let _docker = match Docker::connect_with_local_defaults() {
    //     Ok(docker) => docker,
    //     Err(e) => return Err(format!("Failed to connect to Docker: {}", e)),
    // };

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            list_containers,
            list_images,
            start_container,
            stop_container,
            remove_container,
            pull_image,
            remove_image,
            get_container_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
