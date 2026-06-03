# AWS Network Egress Options

The Production Phase 2 Terraform scaffold places ECS tasks in private app
subnets. Private tasks need a route to AWS services for image pulls, logs,
secrets, and runtime dependencies.

This document compares the two first-demo options. It is planning guidance only;
it does not create resources.

## Option A: NAT Gateway

NAT Gateway is the simpler first deploy path.

Private ECS tasks can use NAT egress to reach:

- ECR API
- ECR Docker registry
- CloudWatch Logs
- Secrets Manager
- STS, if needed by task credentials or deployment tooling
- public internet dependencies

Tradeoffs:

- simpler to understand and operate for the first demo
- fewer service-specific endpoint decisions before deploy
- costs continuously while provisioned
- can add data processing charges
- sends private subnet outbound traffic through a broad internet egress path

Use this option only if the budget owner explicitly accepts the continuous cost.

## Option B: VPC Endpoints

VPC endpoints are more controlled but require more setup detail.

Likely endpoints for this app:

- ECR API interface endpoint: `com.amazonaws.<region>.ecr.api`
- ECR Docker interface endpoint: `com.amazonaws.<region>.ecr.dkr`
- CloudWatch Logs interface endpoint: `com.amazonaws.<region>.logs`
- Secrets Manager interface endpoint: `com.amazonaws.<region>.secretsmanager`
- S3 gateway endpoint for ECR image layer storage access
- STS interface endpoint if task or deploy flows need it

Tradeoffs:

- more explicit egress path for private ECS tasks
- less broad outbound internet access
- more Terraform resources, security group rules, and DNS details
- still has pricing to review for interface endpoint hourly and data costs
- may still need NAT for unexpected public internet dependencies

## First Public Demo Recommendation

For the first public demo:

- Use NAT Gateway only if the budget owner accepts the continuous cost.
- Otherwise keep the first deploy preflight ready and add endpoint-based private
  subnet egress in a later hardening pass before applying Terraform.

Do not assume private ECS tasks can start successfully without either NAT egress
or the required VPC endpoints for ECR, CloudWatch Logs, Secrets Manager, and S3.
