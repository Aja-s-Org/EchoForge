# 1. Generate the unique suffix
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# 2. Create the GCS Bucket
resource "google_storage_bucket" "samples" {
  name          = "echoforge-samples-${random_id.bucket_suffix.hex}"
  location      = "US" # Multi-region or a specific region like "US-CENTRAL1"
  force_destroy = true

  lifecycle_rule {
    condition {
      age = 1 # days
    }
    action {
      type = "Delete"
    }
  }

  uniform_bucket_level_access = true

  # 3. CRITICAL: CORS configuration for your Frontend
  cors {
    origin          = ["http://localhost:4200", "https://yourdomain.com"]
    method          = ["GET", "PUT", "POST", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Model files for the voice inference service (F5-TTS, Vocos vocoder, Whisper),
# staged with `nx run voice-inference:stage-models`. Unlike samples, these are
# kept: no lifecycle rule. Regional, in the same region as Cloud Run, so the
# service copies them quickly at startup.
resource "google_storage_bucket" "models" {
  name                        = "echoforge-models-${random_id.bucket_suffix.hex}"
  location                    = upper(var.gcp_region)
  force_destroy               = true
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}
