variable "app_name" {
  type        = string
  description = "Prefix for resource names"
}

variable "gcp_region" {
  type        = string
  description = "The GCP region where the service is deployed"
}

variable "docker_image" {
  type        = string
  description = "The URI of the voice-inference image (e.g. from Artifact Registry)"
}

variable "service_account_email" {
  type        = string
  description = "The service account the service runs as; needs read access to the models bucket"
}

variable "invoker_service_accounts" {
  type        = list(string)
  description = "Service account emails allowed to call the service"
}

variable "model_bucket_name" {
  type        = string
  description = "Bucket holding the model files"
}

variable "model_prefix" {
  type        = string
  description = "Prefix of the model files in the bucket"
}

variable "cpu" {
  type        = string
  description = "vCPUs per instance (1, 2, 4, 6 or 8)"
}

variable "memory" {
  type        = string
  description = "Memory per instance, e.g. 16Gi (over 8Gi needs at least 4 vCPUs)"
}

variable "min_instances" {
  type        = number
  description = "Instances kept warm; 0 scales to zero, so the first request waits for a cold start"
}

variable "max_instances" {
  type        = number
  description = "Upper bound on instances (each handles one clone at a time)"
}

variable "request_timeout_seconds" {
  type        = number
  description = "Maximum time for one clone request (at most 3600)"
}
