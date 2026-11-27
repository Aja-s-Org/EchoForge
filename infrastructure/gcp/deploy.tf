# To deploy to GCP
module "gcp_api" {
  source       = "../modules/gcp_backend"
  app_name     = var.app_name
  docker_image = var.gcp_docker_image
  bucket_name  = google_storage_bucket.samples.name
  gcp_region   = var.gcp_region
  # NEW: Pass the Service Account email into the module
  service_account_email = google_service_account.backend_sa.email
  voice_inference_url   = module.gcp_voice_inference.url

  voice_inference_timeout_seconds = var.voice_inference_request_timeout_seconds
}

# The private F5-TTS service the API sends clone jobs to
module "gcp_voice_inference" {
  source                   = "../modules/gcp_voice_inference"
  app_name                 = var.app_name
  gcp_region               = var.gcp_region
  docker_image             = var.gcp_voice_inference_image
  service_account_email    = google_service_account.voice_inference_sa.email
  invoker_service_accounts = [google_service_account.backend_sa.email]
  model_bucket_name        = google_storage_bucket.models.name
  model_prefix             = var.voice_inference_model_prefix
  cpu                      = var.voice_inference_cpu
  memory                   = var.voice_inference_memory
  min_instances            = var.voice_inference_min_instances
  max_instances            = var.voice_inference_max_instances
  request_timeout_seconds  = var.voice_inference_request_timeout_seconds

  # The service reads the models at startup, so it needs the read access first.
  depends_on = [google_storage_bucket_iam_member.voice_inference_models_reader]
}

output "api_url" {
  value = module.gcp_api.api_url
}

output "voice_inference_url" {
  value = module.gcp_voice_inference.url
}

output "voice_inference_model_bucket" {
  description = "MODEL_BUCKET for `nx run voice-inference:stage-models`"
  value       = "gs://${google_storage_bucket.models.name}/${var.voice_inference_model_prefix}"
}
