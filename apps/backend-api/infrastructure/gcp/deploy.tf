# To deploy to GCP
module "gcp_api" {
  source       = "../modules/gcp_backend"
  app_name     = var.app_name
  docker_image = var.gcp_docker_image
  bucket_name  = google_storage_bucket.samples.name
  # NEW: Pass the Service Account email into the module
  service_account_email = google_service_account.backend_sa.email
}