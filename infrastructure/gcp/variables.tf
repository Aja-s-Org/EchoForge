variable "app_name" {
  default = "echoforge-gcp-backend"
}

variable "gcp_project_id" {
  type = string
}

variable "gcp_region" {
  type    = string
  default = "us-central1"
}

variable "gcp_docker_image" {
  type = string
  description = "The URI of the Docker image from Artifact Registry"
}

variable "environment" {
  default = "production"
}