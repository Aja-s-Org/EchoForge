# 1. Create a dedicated Service Account for EchoForge
resource "google_service_account" "backend_sa" {
  account_id   = "echoforge-api-sa"
  display_name = "EchoForge API Identity"
  description  = "Used by Cloud Run to generate pre-signed URLs and access Storage"
}

# Allow the backend Service Account to create Signed URLs
resource "google_project_iam_member" "backend_sa_token_creator" {
  project = var.gcp_project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# 2. Grant the Service Account permission to the Bucket
resource "google_storage_bucket_iam_member" "storage_admin" {
  # Fix: Use the real resource name since we are in the root folder
  bucket = google_storage_bucket.samples.name

  role   = "roles/storage.objectAdmin" # Perfect role for signed URLs and PUT/GET
  member = "serviceAccount:${google_service_account.backend_sa.email}"
}

# 3. Identity for the voice inference service: it only reads model files.
resource "google_service_account" "voice_inference_sa" {
  account_id   = "echoforge-inference-sa"
  display_name = "EchoForge Voice Inference Identity"
  description  = "Used by the voice inference Cloud Run service to read model files"
}

resource "google_storage_bucket_iam_member" "voice_inference_models_reader" {
  bucket = google_storage_bucket.models.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.voice_inference_sa.email}"
}
