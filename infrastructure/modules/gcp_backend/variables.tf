variable "app_name" {
  default = "echoforge-aws-backend"
}

variable "bucket_name" {
  type        = string
  description = "The name of the bucket where voice samples are stored"
}

variable "docker_image" {
  type        = string
  description = "The URI of the Docker image (e.g. from Artifact Registry)"
}

variable "service_account_email" {
  type        = string
  description = "The service account email to run the Cloud Run container"
}