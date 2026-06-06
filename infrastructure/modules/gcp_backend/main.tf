# 1. The Cloud Run Service (Your NestJS Container)
resource "google_cloud_run_v2_service" "api" {
  name     = "${var.app_name}-api"
  location = var.gcp_region
  
  # Cloud Run v2 handles ingress routing elegantly
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    # NEW: Tell Cloud Run to assume this specific identity!
    service_account = var.service_account_email
    
    containers {
      image = var.docker_image

      # Injecting the environment variables for your NestJS app
      env {
        name  = "CLOUD_PROVIDER"
        value = "gcp"
      }
      env {
        name  = "ECHOFORGE_SAMPLES_BUCKET"
        value = var.bucket_name
      }

      # Standard port for NestJS
      ports {
        container_port = 3000
      }

      # Resource limits to control billing
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }
}

# 2. IAM Policy: Make the API Publicly Accessible
# Without this, GCP will return a 403 to anyone who isn't logged into your GCP account.
data "google_iam_policy" "noauth" {
  binding {
    role = "roles/run.invoker"
    members = [
      "allUsers",
    ]
  }
}

# Allow public access (unauthenticated)
resource "google_cloud_run_v2_service_iam_member" "noauth" {
  location = google_cloud_run_v2_service.api.location
  project  = google_cloud_run_v2_service.api.project
  name     = google_cloud_run_v2_service.api.name

  role   = "roles/run.invoker"
  member = "allUsers"
}

# 3. Output the generated URL so you can hit it from your frontend
output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}