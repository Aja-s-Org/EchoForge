variable "app_name" {
  default = "echoforge-aws-backend"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_docker_image" {
  type = string
  description = "The URI of the Docker image from ECR"
}

variable "environment" {
  default = "production"
}