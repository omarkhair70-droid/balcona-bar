# Balcona Bar AWS Terraform Foundation

This folder is the Production Phase 2 AWS infrastructure scaffold. It is safe
infrastructure-as-code only; it does not deploy anything until an operator runs
Terraform commands with real AWS credentials and reviewed variables.

## What It Defines

- VPC with public, private app, and private data subnets
- Internet gateway and optional NAT gateway
- Security groups for ALB, ECS, RDS, and Redis
- ECR repositories for API and Web images
- RDS PostgreSQL with AWS-managed master password
- ElastiCache Redis
- ECS Fargate cluster, task definitions, and services for API and Web
- Application Load Balancer with path-based API routing
- CloudWatch log groups
- Secrets Manager placeholders for `DATABASE_URL`, `REDIS_URL`, and future AI keys
- Domain, ACM, and CloudFront placeholder example

## Safe Workflow

```bash
cd infra/aws/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt -recursive
terraform validate
terraform plan
```

Review the plan carefully before any real deployment. Do not run
`terraform apply` until Production Phase 3 has real AWS account, DNS, image, and
secret values.

## Required Before First Apply

- Confirm AWS account and region.
- Replace example image URIs after pushing API/Web images to ECR.
- Decide whether `enable_nat_gateway` is worth the cost.
- Choose real app/API domains and ACM certificate plan.
- Populate Secrets Manager values for `DATABASE_URL` and `REDIS_URL`.
- Confirm RDS deletion protection and backup retention.

## Domain/TLS

`domain-placeholders.tf.example` is intentionally not active Terraform. Copy it
to `domain.tf` only after real Route 53 hosted zone, ACM certificate, and
CloudFront decisions are made.

## Cost Notes

RDS, ElastiCache, NAT Gateway, ECS tasks, ALB, and CloudWatch logs can all incur
cost. Defaults are small for staging, not final production sizing.
