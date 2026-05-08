output "project_id" {
  description = "GCP project ID."
  value       = var.project_id
}

output "firestore_database_name" {
  description = "Firestore database name."
  value       = google_firestore_database.default.name
}

output "uploads_bucket_name" {
  description = "Cloud Storage bucket for user uploads."
  value       = google_storage_bucket.user_uploads.name
}

output "uploads_bucket_url" {
  description = "Cloud Storage bucket URL."
  value       = google_storage_bucket.user_uploads.url
}