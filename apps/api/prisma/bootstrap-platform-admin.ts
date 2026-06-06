import {
  PlatformAdminRole,
  PlatformAdminStatus,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD_HASH_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 16;

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for platform admin bootstrap.`);
  }

  return value;
}

async function main() {
  if (process.env.PLATFORM_ADMIN_BOOTSTRAP_ENABLED !== 'true') {
    throw new Error(
      'Set PLATFORM_ADMIN_BOOTSTRAP_ENABLED=true only for the one-time staging bootstrap command.',
    );
  }

  const email = readRequiredEnv('PLATFORM_ADMIN_EMAIL').toLowerCase();
  const password = readRequiredEnv('PLATFORM_ADMIN_PASSWORD');
  const name =
    process.env.PLATFORM_ADMIN_NAME?.trim() || 'Balcona Platform Admin';

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `PLATFORM_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

  const platformAdminUser = await prisma.platformAdminUser.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: PlatformAdminRole.owner,
      status: PlatformAdminStatus.active,
    },
    create: {
      email,
      name,
      passwordHash,
      role: PlatformAdminRole.owner,
      status: PlatformAdminStatus.active,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        platformAdminUser,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
