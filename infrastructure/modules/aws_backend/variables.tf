variable "app_name" {
  default = "echoforge-aws-backend"
}

variable "bucket_name" {
  type        = string
  description = "The name of the bucket where voice samples are stored"
}

variable "docker_image" {
  type = string
  description = "The URI of the Docker image from ECR"
}

variable "task_role_arn" {
  type        = string
  description = "The ARN of the IAM role the application code will assume"
}
