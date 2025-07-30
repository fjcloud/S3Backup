variable "aws_region" {
  description = "AWS region for the S3 bucket and resources"
  type        = string
  default     = "us-east-1"
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.aws_region))
    error_message = "AWS region must be a valid region name."
  }
}

variable "bucket_name_prefix" {
  description = "Prefix for the S3 bucket name"
  type        = string
  default     = "s3-photo-backup-"
}

variable "enable_versioning" {
  description = "Enable versioning on the S3 bucket"
  type        = bool
  default     = true
}

variable "enable_sse" {
  description = "Enable server-side encryption on the S3 bucket"
  type        = bool
  default     = true
}

variable "block_public_access" {
  description = "Block all public access to the S3 bucket"
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS"
  type        = list(string)
  default     = ["*"]  # For development - restrict in production
  
  validation {
    condition = alltrue([
      for origin in var.cors_allowed_origins : 
      origin == "*" || can(regex("^https?://", origin))
    ])
    error_message = "CORS origins must be valid URLs or '*' for all origins."
  }
} 