import { PrismaClient, StaffRole } from '@prisma/client';

const prisma = new PrismaClient();

const companySlug = 'balcona-bar';
const branchSlug = 'main-branch';

const staffSeed: Array<{ email: string; name: string; role: StaffRole }> = [
  { email: 'owner@balcona.local', name: 'Balcona Owner', role: 'owner' },
  { email: 'manager@balcona.local', name: 'Main Branch Manager', role: 'branch_manager' },
  { email: 'cashier@balcona.local', name: 'Main Branch Cashier', role: 'cashier' },
  { email: 'waiter@balcona.local', name: 'Main Branch Waiter', role: 'waiter' },
  { email: 'kitchen@balcona.local', name: 'Main Branch Kitchen', role: 'kitchen' },
  { email: 'barista@balcona.local', name: 'Main Branch Barista', role: 'barista' },
];

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: companySlug },
    update: {
      name: 'Balcona Bar',
      status: 'active',
    },
    create: {
      name: 'Balcona Bar',
      slug: companySlug,
      status: 'active',
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      companyId_slug: {
        companyId: company.id,
        slug: branchSlug,
      },
    },
    update: {
      name: 'Main Branch',
      address: 'Demo address for local development',
      status: 'active',
    },
    create: {
      companyId: company.id,
      name: 'Main Branch',
      slug: branchSlug,
      address: 'Demo address for local development',
      status: 'active',
    },
  });

  const floor = await prisma.floor.upsert({
    where: {
      id: `${branch.id}:ground-floor`,
    },
    update: {
      name: 'Ground Floor',
      sortOrder: 1,
    },
    create: {
      id: `${branch.id}:ground-floor`,
      branchId: branch.id,
      name: 'Ground Floor',
      sortOrder: 1,
    },
  });

  for (let index = 1; index <= 6; index += 1) {
    const code = `T${String(index).padStart(2, '0')}`;

    await prisma.cafeTable.upsert({
      where: {
        branchId_code: {
          branchId: branch.id,
          code,
        },
      },
      update: {
        displayName: `Table ${index}`,
        floorId: floor.id,
        capacity: 4,
        qrToken: `balcona-main-${code.toLowerCase()}`,
        status: 'active',
      },
      create: {
        branchId: branch.id,
        floorId: floor.id,
        code,
        displayName: `Table ${index}`,
        capacity: 4,
        qrToken: `balcona-main-${code.toLowerCase()}`,
        status: 'active',
      },
    });
  }

  for (const staff of staffSeed) {
    const staffUser = await prisma.staffUser.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        status: 'active',
      },
      create: {
        email: staff.email,
        name: staff.name,
        status: 'active',
      },
    });

    const membershipBranchId = staff.role === 'owner' ? null : branch.id;
    const existingMembership = await prisma.staffMembership.findFirst({
      where: {
        staffUserId: staffUser.id,
        companyId: company.id,
        branchId: membershipBranchId,
        role: staff.role,
      },
    });

    if (existingMembership) {
      await prisma.staffMembership.update({
        where: { id: existingMembership.id },
        data: { status: 'active' },
      });
    } else {
      await prisma.staffMembership.create({
        data: {
          staffUserId: staffUser.id,
          companyId: company.id,
          branchId: membershipBranchId,
          role: staff.role,
          status: 'active',
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
