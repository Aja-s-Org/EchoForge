# 1. The Cloud Run Service (Your NestJS Container)
resource "google_cloud_run_v2_service" "api" {
  name     = "${var.app_name}-api"
  location = var.gcp_region

  # Cloud Run v2 handles ingress routing elegantly
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    # NEW: Tell Cloud Run to assume this specific identity!
    service_account = var.service_account_email

    # Jobs are kept in memory and processed in the background after the API
    # answers 202, so (until there is a database and a queue) the API must be
    # a single instance that keeps its CPU between requests. Otherwise a status
    # request can land on an instance that doesn't know the job, and background
    # processing is throttled once the request ends.
    scaling {
      min_instance_count = 1
      max_instance_count = 1
    }

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
      env {
        name  = "VOICE_INFERENCE_URL"
        value = var.voice_inference_url
      }
      env {
        # Call the private inference service with this service account's identity token
        name  = "VOICE_INFERENCE_AUTH"
        value = "gcp-id-token"
      }
      env {
        # Wait as long as the inference service allows a request to run
        name  = "VOICE_INFERENCE_TIMEOUT_MS"
        value = tostring(var.voice_inference_timeout_seconds * 1000)
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
        # Keep CPU allocated outside requests for background job processing.
        cpu_idle = false
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
resource "google_cloud_run_v2_service_iam_policy" "noauth" {
  location    = google_cloud_run_v2_service.api.location
  project     = google_cloud_run_v2_service.api.project
  name        = google_cloud_run_v2_service.api.name
  policy_data = data.google_iam_policy.noauth.policy_data
}

# 3. Output the generated URL so you can hit it from your frontend
output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}