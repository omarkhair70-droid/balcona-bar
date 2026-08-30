import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  logs: string | null;
};

export type MigrationReadiness = {
  status: "ready" | "pending" | "failed" | "unavailable";
  expected: number;
  applied: number;
  pending: number;
  failed: number;
  checkedAt: string;
};

export type DeploymentReadiness = {
  gitSha: string;
  buildTime: string;
  migration: MigrationReadiness;
};

@Injectable()
export class DeploymentReadinessService {
  private cached?: { expiresAt: number; value: DeploymentReadiness };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async snapshot(): Promise<DeploymentReadiness> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.value;
    }

    const value = {
      gitSha: this.configService.get<string>("app.gitSha") ?? "unknown",
      buildTime:
        this.configService.get<string>("app.buildTime") ?? "not_provided",
      migration: await this.checkMigrations(),
    } satisfies DeploymentReadiness;

    this.cached = { expiresAt: Date.now() + 60_000, value };
    return value;
  }

  private async checkMigrations(): Promise<MigrationReadiness> {
    const checkedAt = new Date().toISOString();

    try {
      const migrationRoot = join(process.cwd(), "prisma", "migrations");
      const entries = await readdir(migrationRoot, { withFileTypes: true });
      const expectedNames = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      const rows = await this.prisma.$queryRawUnsafe<MigrationRow[]>(
        'SELECT migration_name, finished_at, rolled_back_at, logs FROM "_prisma_migrations"',
      );
      const appliedNames = new Set(
        rows
          .filter((row) => row.finished_at && !row.rolled_back_at)
          .map((row) => row.migration_name),
      );
      const failed = rows.filter(
        (row) => !row.finished_at && !row.rolled_back_at && Boolean(row.logs),
      ).length;
      const pending = expectedNames.filter(
        (migrationName) => !appliedNames.has(migrationName),
      ).length;

      return {
        status: failed > 0 ? "failed" : pending > 0 ? "pending" : "ready",
        expected: expectedNames.length,
        applied: expectedNames.length - pending,
        pending,
        failed,
        checkedAt,
      };
    } catch {
      return {
        status: "unavailable",
        expected: 0,
        applied: 0,
        pending: 0,
        failed: 0,
        checkedAt,
      };
    }
  }
}
