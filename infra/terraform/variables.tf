variable "project_id" {
  description = "The GCP project ID for LifeHub."
  type        = string
}

variable "region" {
  description = "Default GCP region for LifeHub resources."
  type        = string
  default     = "asia-northeast1"
}
variable "firestore_location" {
  description = "Firestore database location."
  type        = string
  default     = "asia-northeast1"
}

variable "storage_location" {
  description = "Cloud Storage bucket location."
  type        = string
  default     = "ASIA-NORTHEAST1"
}

variable "uploads_bucket_name" {
  description = "Cloud Storage bucket name for LifeHub user uploads."
  type        = string
}