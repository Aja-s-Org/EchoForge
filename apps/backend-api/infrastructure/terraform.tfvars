variable "app_name" {
  default = "echoforge-backend"
}

variable "docker_image" {
  description = "The URI of the Docker image from ECR or Artifact Registry"
}

variable "environment" {
  default = "production"
}