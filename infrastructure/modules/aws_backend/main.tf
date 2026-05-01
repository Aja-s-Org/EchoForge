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
  cluster         = aws_ecs_cluster.echoforge_cluster.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids   # Changed from var.public_subnets
    security_groups  = [aws_security_group.ecs_sg.id] # NEW! Allows port 3000
    assign_public_ip = true
  }
}

resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/ecs/${var.app_name}"
  retention_in_days = 14
}

# 1. Grab the Default VPC
data "aws_vpc" "default" {
  default = true
}

# 2. Grab the Default Subnets in that VPC
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# 3. Create a Security Group to allow Port 3000 traffic
resource "aws_security_group" "ecs_sg" {
  name        = "${var.app_name}-sg"
  description = "Allow inbound traffic to NestJS"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Allow Port 3000"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}