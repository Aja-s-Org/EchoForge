variable "app_name" {
  default = "echoforge-aws-backend"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "docker_image" {
  type = string
  description = "The URI of the Docker image from ECR"
}

variable "environment" {
  default = "production"
}

variable "task_role_arn" {
  type        = string
  description = "The ARN of the IAM role the application code will assume"
}