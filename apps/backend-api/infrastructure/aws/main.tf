resource "aws_ecs_cluster" "echoforge_cluster" {
  name = "${var.app_name}-cluster"
}

resource "aws_ecs_task_definition" "app" {
  family                   = var.app_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([{
    name  = var.app_name
    image = var.docker_image
    environment = [
      { name = "CLOUD_PROVIDER", value = "aws" },
      { name = "ECHOFORGE_SAMPLES_BUCKET", value = var.bucket_name }
    ]
    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
    }]
  }])
}

resource "aws_ecs_service" "main" {
  name            = "${var.app_name}-service"
  cluster         = aws_ecs_cluster.echoforge_cluster.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnets
    assign_public_ip = true
  }
}

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

# 3. Output the name so you can see it in your terminal
output "bucket_name" {
  value = aws_s3_bucket.samples.id
}