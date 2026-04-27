# To deploy to AWS
module "aws_api" {
  source       = "../modules/aws_backend"
  app_name     = var.app_name
  docker_image = var.aws_docker_image
  bucket_name  = aws_s3_bucket.samples.id
  # NEW: Pass the Task Role ARN into the module
  task_role_arn = aws_iam_role.ecs_task_role.arn
}