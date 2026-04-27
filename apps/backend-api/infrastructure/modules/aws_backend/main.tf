# 1. The ECS Cluster
resource "aws_ecs_cluster" "echoforge_cluster" {
  name = "${var.app_name}-cluster"
}

# 2. IAM Role for Fargate to execute and pull images
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.app_name}-ecs-execution-role"
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

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# 3. The Task Definition (Your NestJS Container)
resource "aws_ecs_task_definition" "app" {
  family                   = var.app_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  # NEW: The application role (talking to S3)
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([{
    name  = var.app_name
    image = var.docker_image
    
    # Here is where the bucket variable gets injected into your app!
    environment = [
      { name = "CLOUD_PROVIDER", value = "aws" },
      { name = "ECHOFORGE_SAMPLES_BUCKET", value = var.bucket_name }
    ]
    
    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
    }]
    
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.app_name}"
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# 4. The ECS Service (Keeps the container running)
resource "aws_ecs_service" "main" {
  name            = "${var.app_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    # Note: In a production setup, you'd pass your VPC subnets in as variables too
    subnets          = var.public_subnets
    assign_public_ip = true
  }
}