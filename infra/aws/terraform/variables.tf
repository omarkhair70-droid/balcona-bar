variable "project_name" {
  description = "Short project identifier used in AWS resource names."
  type        = string
  default     = "balcona-bar"
}

variable "environment" {
  description = "Deployment environment name, for example staging or production."
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region for regional resources."
  type        = string
  default     = "eu-central-1"
}

variable "availability_zones" {
  description = "Optional explicit AZ list. Defaults to the first two available AZs in aws_region."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional tags applied to all supported resources."
  type        = map(string)
  default     = {}
}

variable "vpc_cidr" {
  description = "CIDR block for the application VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Whether private app subnets should route outbound traffic through NAT. NAT gateways cost money continuously."
  type        = bool
  default     = false
}

variable "allowed_http_cidr_blocks" {
  description = "CIDR blocks allowed to reach the public ALB on HTTP/HTTPS."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "api_image_uri" {
  description = "Full ECR image URI for the API container. Replace before real deployment."
  type        = string
  default     = "public.ecr.aws/example/balcona-api:replace-me"
}

variable "web_image_uri" {
  description = "Full ECR image URI for the Web container. Replace before real deployment."
  type        = string
  default     = "public.ecr.aws/example/balcona-web:replace-me"
}

variable "api_container_port" {
  description = "API container port."
  type        = number
  default     = 3000
}

variable "web_container_port" {
  description = "Web container port."
  type        = number
  default     = 3001
}

variable "api_desired_count" {
  description = "Initial API ECS desired count. Use 1 for staging smoke tests, increase later."
  type        = number
  default     = 1
}

variable "web_desired_count" {
  description = "Initial Web ECS desired count. Use 1 for staging smoke tests, increase later."
  type        = number
  default     = 1
}

variable "api_cpu" {
  description = "API Fargate task CPU units."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "API Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "web_cpu" {
  description = "Web Fargate task CPU units."
  type        = number
  default     = 512
}

variable "web_memory" {
  description = "Web Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "web_origin" {
  description = "Public web origin used for API CORS_ORIGINS."
  type        = string
  default     = "https://app.example.com"
}

variable "public_api_base_url" {
  description = "Browser-facing API URL used by the web app for NEXT_PUBLIC_API_BASE_URL."
  type        = string
  default     = "https://api.example.com/api/v1"
}

variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN for an HTTPS ALB listener. Leave empty until DNS/TLS is ready."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 30
}

variable "db_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "balcona_bar"
}

variable "db_username" {
  description = "RDS master username. Password is managed by AWS Secrets Manager."
  type        = string
  default     = "balcona_app"
}

variable "db_instance_class" {
  description = "RDS instance class. Small default is for staging only."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 20
}

variable "db_backup_retention_days" {
  description = "RDS backup retention days."
  type        = number
  default     = 7
}

variable "db_deletion_protection" {
  description = "Enable RDS deletion protection. Keep true for production."
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  description = "Skip final snapshot on DB deletion. Keep false outside disposable staging."
  type        = bool
  default     = false
}

variable "redis_node_type" {
  description = "ElastiCache node type. Small default is for staging only."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_engine_version" {
  description = "Redis engine major/minor version."
  type        = string
  default     = "7.1"
}

variable "redis_transit_encryption_enabled" {
  description = "Enable Redis TLS in transit. If true, app REDIS_URL should use rediss://."
  type        = bool
  default     = true
}
