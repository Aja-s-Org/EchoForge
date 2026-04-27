terraform {
  required_version = ">= 1.5.0"

  required_providers {
    # This is for S3, ECS, IAM, etc.
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}