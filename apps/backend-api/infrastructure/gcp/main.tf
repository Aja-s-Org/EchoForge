resource "google_cloud_run_v2_service" "backend" {
  name     = "${var.app_name}-api"
  location = "us-central1"

  template {
    containers {
      image = var.docker_image
      env {
        name  = "CLOUD_PROVIDER"
        value = "gcp"
      }
      env {
        name  = "ECHOFORGE_SAMPLES_BUCKET"
        value = var.bucket_name
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "1024Mi"
        }
      }
    }
  }
}

# Allow public access (unauthenticated)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  name     = google_cloud_run_v2_service.backend.name
  location = google_cloud_run_v2_service.backend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}