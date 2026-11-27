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
  type        = string
  description = "The URI of the Docker image from Artifact Registry"
}

variable "environment" {
  default = "production"
}

variable "gcp_voice_inference_image" {
  type        = string
  description = "The URI of the voice-inference Docker image from Artifact Registry"
}

variable "voice_inference_model_prefix" {
  type        = string
  default     = "models/v1"
  description = "Prefix of the staged model files in the models bucket"
}

# Sizing for CPU inference, from a local run of the image with the real models
# (16 s of generated speech from a 5 s sample):
#
#   4 vCPU: 318 s per clone (343 s when Whisper transcribes the sample)
#   8 vCPU: 229 s per clone (250 s with Whisper), 1.4x faster for 2x the CPU
#   memory: 5.6 GiB peak with F5-TTS and Whisper loaded, on either
#
# 4 vCPU is the cheaper option per clone; 8 vCPU (Cloud Run's maximum) gives
# lower latency. Generation runs at about 20x real time on 4 vCPU, so the
# request timeout covers roughly 3 minutes of generated speech.
variable "voice_inference_cpu" {
  type    = string
  default = "4"
}

variable "voice_inference_memory" {
  type    = string
  default = "8Gi"
}

variable "voice_inference_min_instances" {
  type        = number
  default     = 0
  description = "0 scales to zero when idle; the first request then waits for a cold start (model copy and load)"
}

variable "voice_inference_max_instances" {
  type    = number
  default = 2
}

variable "voice_inference_request_timeout_seconds" {
  type    = number
  default = 3600
}
