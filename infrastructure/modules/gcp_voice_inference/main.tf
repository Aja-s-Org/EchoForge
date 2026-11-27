# The voice inference service (apps/voice-inference): F5-TTS on CPU, private.
resource "google_cloud_run_v2_service" "inference" {
  name     = "${var.app_name}-voice-inference"
  location = var.gcp_region

  # Reachable over the internet, but every request needs an identity token for
  # a service account with roles/run.invoker (see below); there is no allUsers
  # binding.
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = var.service_account_email

    # Each instance runs one clone at a time; CPU inference uses every core.
    max_instance_request_concurrency = 1

    # CPU inference of a long text can take several minutes.
    timeout = "${var.request_timeout_seconds}s"

    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.docker_image

      env {
        name  = "MODEL_BUCKET"
        value = "gs://${var.model_bucket_name}/${var.model_prefix}"
      }

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        # Only bill for CPU while handling a request; instances scale to zero.
        cpu_idle          = true
        startup_cpu_boost = true
      }

      # Copying about 3 GB of models from the bucket and loading them takes a
      # while; /health returns 503 until the model is loaded. Cloud Run allows
      # at most 600 s (failure_threshold * period_seconds) for startup.
      startup_probe {
        initial_delay_seconds = 0
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 60
        http_get {
          path = "/health"
          port = 8080
        }
      }

      # /health turns 503 if model loading failed, so restart the instance.
      liveness_probe {
        period_seconds    = 30
        timeout_seconds   = 5
        failure_threshold = 3
        http_get {
          path = "/health"
          port = 8080
        }
      }
    }
  }
}

# Only the listed service accounts (the backend) may call the service.
resource "google_cloud_run_v2_service_iam_member" "invokers" {
  for_each = toset(var.invoker_service_accounts)

  location = google_cloud_run_v2_service.inference.location
  project  = google_cloud_run_v2_service.inference.project
  name     = google_cloud_run_v2_service.inference.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${each.value}"
}

output "url" {
  description = "Base URL of the voice inference service"
  value       = google_cloud_run_v2_service.inference.uri
}
