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

variable "bucket_name" {
  type        = string
  description = "The name of the GCS bucket"
}

variable "docker_image" {
  type = string
  description = "The URI of the Docker image from Artifact Registry"
}

variable "environment" {
  default = "production"
}

# Add this so the module knows to expect the email
variable "service_account_email" {
  type        = string
  description = "The service account email to run the Cloud Run container"
}