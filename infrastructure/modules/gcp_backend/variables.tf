variable "app_name" {
  default = "echoforge-gcp-backend"
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

variable "gcp_region" {
  type        = string
  description = "The GCP region where Cloud Run resources are deployed"
}

variable "voice_inference_url" {
  type        = string
  description = "Base URL of the voice inference service the API sends clone jobs to"
}

variable "voice_inference_timeout_seconds" {
  type        = number
  description = "How long the API waits for one clone; matches the inference service's request timeout"
}
