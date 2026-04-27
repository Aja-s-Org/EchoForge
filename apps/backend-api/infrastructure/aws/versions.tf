terraform {
  required_version = ">= 1.5.0"

  required_providers {
    # This is for S3, ECS, IAM, etc.
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # THIS is what I meant. 
    # It tells Terraform to download the "random" plugin.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# This was the missing piece for symmetry!
provider "aws" {
  region = var.aws_region
  
  # Optional: Professional touch to tag all resources automatically
  default_tags {
    tags = {
      Project   = "EchoForge"
      ManagedBy = "Terraform"
    }
  }
}