# Configure AWS Provider
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Generate random bucket name
resource "random_id" "bucket_name" {
  byte_length = 8
  prefix      = var.bucket_name_prefix
}

# S3 Bucket for photo storage
resource "aws_s3_bucket" "photo_backup" {
  bucket = random_id.bucket_name.hex
}

# Enable versioning
resource "aws_s3_bucket_versioning" "photo_backup" {
  bucket = aws_s3_bucket.photo_backup.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "photo_backup" {
  bucket = aws_s3_bucket.photo_backup.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "photo_backup" {
  bucket = aws_s3_bucket.photo_backup.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration for web app
resource "aws_s3_bucket_cors_configuration" "photo_backup" {
  bucket = aws_s3_bucket.photo_backup.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# IAM User for the application
resource "aws_iam_user" "photo_backup_user" {
  name = "s3-photo-backup-user"
  
  tags = {
    Purpose = "S3 Photo Backup App"
  }
}

# IAM Access Key for the user
resource "aws_iam_access_key" "photo_backup_user" {
  user = aws_iam_user.photo_backup_user.name
}

# IAM Policy for S3 access with SSE-C
resource "aws_iam_policy" "s3_photo_backup_policy" {
  name        = "s3-photo-backup-policy"
  description = "Policy for S3 Photo Backup application"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          aws_s3_bucket.photo_backup.arn,
          "${aws_s3_bucket.photo_backup.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersion"
        ]
        Resource = "${aws_s3_bucket.photo_backup.arn}/*"
        Condition = {
          StringEquals = {
            "s3:VersionId" = "*"
          }
        }
      }
    ]
  })
}

# Attach policy to user
resource "aws_iam_user_policy_attachment" "photo_backup_user_policy" {
  user       = aws_iam_user.photo_backup_user.name
  policy_arn = aws_iam_policy.s3_photo_backup_policy.arn
}

# Outputs
output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.photo_backup.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.photo_backup.arn
}

output "access_key_id" {
  description = "Access Key ID for the IAM user"
  value       = aws_iam_access_key.photo_backup_user.id
  sensitive   = false
}

output "secret_access_key" {
  description = "Secret Access Key for the IAM user"
  value       = aws_iam_access_key.photo_backup_user.secret
  sensitive   = true
}

output "user_arn" {
  description = "ARN of the IAM user"
  value       = aws_iam_user.photo_backup_user.arn
}

output "app_configuration" {
  description = "Configuration for the S3 Photo Backup app"
  value = {
    s3_endpoint = "https://s3.amazonaws.com"
    s3_region   = var.aws_region
    s3_bucket   = aws_s3_bucket.photo_backup.bucket
    s3_access_key = aws_iam_access_key.photo_backup_user.id
    s3_secret_key = aws_iam_access_key.photo_backup_user.secret
  }
  sensitive = true
} 