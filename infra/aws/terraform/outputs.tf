output "vpc_id" {
  description = "Application VPC ID."
  value       = aws_vpc.main.id
}

output "alb_dns_name" {
  description = "Public ALB DNS name for smoke testing before DNS is finalized."
  value       = aws_lb.main.dns_name
}

output "api_ecr_repository_url" {
  description = "API ECR repository URL."
  value       = aws_ecr_repository.api.repository_url
}

output "web_ecr_repository_url" {
  description = "Web ECR repository URL."
  value       = aws_ecr_repository.web.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.main.name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint."
  value       = aws_db_instance.postgres.address
}

output "rds_master_user_secret_arn" {
  description = "AWS-managed RDS master user secret ARN."
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
  sensitive   = true
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint."
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "api_database_url_secret_arn" {
  description = "Secret placeholder for API DATABASE_URL."
  value       = aws_secretsmanager_secret.api_database_url.arn
}

output "api_redis_url_secret_arn" {
  description = "Secret placeholder for API REDIS_URL."
  value       = aws_secretsmanager_secret.api_redis_url.arn
}
