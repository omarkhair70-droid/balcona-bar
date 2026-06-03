resource "aws_secretsmanager_secret" "api_database_url" {
  name        = "${local.name_prefix}/api/DATABASE_URL"
  description = "PostgreSQL connection string for the API. Add a secret value before starting ECS tasks."
}

resource "aws_secretsmanager_secret" "api_redis_url" {
  name        = "${local.name_prefix}/api/REDIS_URL"
  description = "Redis connection string for the API. Use rediss:// when transit encryption is enabled."
}

resource "aws_secretsmanager_secret" "future_openai_api_key" {
  name        = "${local.name_prefix}/future/OPENAI_API_KEY"
  description = "Optional future AI provider key placeholder. Leave unset until an AI integration phase enables it."
}

resource "aws_secretsmanager_secret" "future_anthropic_api_key" {
  name        = "${local.name_prefix}/future/ANTHROPIC_API_KEY"
  description = "Optional future AI provider key placeholder. Leave unset until an AI integration phase enables it."
}
