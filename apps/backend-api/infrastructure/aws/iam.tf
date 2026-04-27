# 1. Create the Task Role (Identity for your NestJS App)
resource "aws_iam_role" "ecs_task_role" {
  name = "EchoForgeApiTaskRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

# 2. Attach your S3 Permissions to the Task Role
resource "aws_iam_role_policy" "storage_policy" {
  name = "EchoForgeStoragePolicy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:AbortMultipartUpload"
        ]
        # Notice we use .arn here, not .id! AWS policies require ARNs.
        Resource = "${aws_s3_bucket.samples.arn}/*" 
      }
    ]
  })
}