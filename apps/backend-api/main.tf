# To deploy to GCP
module "gcp_api" {
  source       = "./modules/gcp_backend"
  app_name     = var.app_name
  docker_image = var.gcp_docker_image
  bucket_name  = google_storage_bucket.samples.name
}

# To deploy to AWS
module "aws_api" {
  source       = "./modules/aws_backend"
  app_name     = var.app_name
  docker_image = var.aws_docker_image
  bucket_name  = aws_s3_bucket.samples.id
}