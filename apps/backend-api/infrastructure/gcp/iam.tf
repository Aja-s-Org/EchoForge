resource "google_storage_bucket_iam_member" "storage_admin" {
  bucket = var.bucket_name
  role   = "roles/storage.objectAdmin" # Allows creating signed URLs
  member = "serviceAccount:${google_service_account.backend_sa.email}"
}