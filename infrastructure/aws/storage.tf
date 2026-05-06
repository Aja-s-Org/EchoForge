# 1. Generate a unique suffix so your bucket name doesn't collide with anyone else
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# 2. Create the actual bucket (The "Origin")
resource "aws_s3_bucket" "samples" {
  bucket = "echoforge-samples-${random_id.bucket_suffix.hex}"
  
  # Ensure the bucket is destroyed even if it contains files (handy for demos)
  force_destroy = true 
}

# 3. The CORS Configuration (Required for Pre-signed URL Uploads)
resource "aws_s3_bucket_cors_configuration" "samples_cors" {
  bucket = aws_s3_bucket.samples.id

  cors_rule {
    # Allow all headers (necessary because browsers send things like Content-Type)
    allowed_headers = ["*"]
    
    # PUT is critical for the pre-signed upload. OPTIONS is for the pre-flight check.
    allowed_methods = ["GET", "PUT", "POST"]
    
    # Restrict this to your actual frontend URLs in production!
    allowed_origins = ["http://localhost:4200", "https://your-production-domain.com"]
    
    # Let the browser read the ETag to confirm upload success
    expose_headers  = ["ETag"]
    
    # Cache the pre-flight response for 1 hour to save network requests
    max_age_seconds = 3600
  }
}

# 4. Output the name so you can see it in your terminal
output "bucket_name" {
  value = aws_s3_bucket.samples.id
}