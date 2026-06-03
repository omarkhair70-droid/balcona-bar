# AWS Deploy Decisions Template

Copy this template before the first public AWS demo deploy and fill it with
approved values. Keep real secrets out of this document.

## Ownership

- AWS account owner:
- Deploy owner:
- Rollback owner:
- Approver for Terraform apply:
- Approver for production secrets:

## Schedule

- Proposed deploy date:
- Proposed deploy time and timezone:
- Demo window:
- Rollback decision deadline:

## AWS Account And Region

- AWS account name or alias:
- AWS account ID placeholder:
- AWS region:
- Backup region, if any:

## Budget And Cost Controls

- Budget limit:
- Budget owner:
- Alert recipients:
- Accepted always-on resources:
- NAT Gateway cost accepted:

## Domains And TLS

- App domain:
- API domain:
- Route 53 hosted zone or external DNS plan:
- ACM certificate plan:
- Certificate validation owner:
- DNS cutover owner:

## Network Egress

- Decision: NAT Gateway or VPC endpoints:
- Reason:
- Owner approving cost/setup tradeoff:
- Follow-up hardening needed:

## Compute And Data Sizing

- API ECS desired count:
- Web ECS desired count:
- API CPU/memory:
- Web CPU/memory:
- RDS size:
- Redis size:
- RDS deletion protection:
- Log retention days:

## Demo Data

- Demo tenant/seed plan:
- Demo company slug:
- Demo branch slug:
- Demo table QR token:
- Staff account plan:
- Staff password/bootstrap plan:

## Deployment Inputs

- API image URI:
- Web image URI:
- Web origin:
- Public API base URL:
- CORS origins:
- Secrets Manager population owner:
- Prisma migration owner:

## Approval

- Terraform plan reviewed by:
- Terraform apply approved by:
- Image tags approved by:
- Secrets population approved by:
- Smoke test owner:
- Go/no-go decision:
