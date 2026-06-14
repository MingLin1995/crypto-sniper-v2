import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedAdminAccounts() {
  console.info('Checking admin accounts seeding status...');

  const initFlag = await prisma.systemConfig.findUnique({
    where: { key: 'admin_accounts_setup_completed' },
  });

  if (initFlag) {
    console.info('Admin default accounts already seeded, skipping.');
    return;
  }

  console.info('Starting admin accounts seeding...');

  const defaultAdmins = [
    {
      email: process.env.ADMIN_EMAIL_1 || 'admin001@example.com',
      nickname: process.env.ADMIN_NICKNAME_1 || 'admin001',
      password: process.env.ADMIN_PASSWORD_1 || '000000',
    },
    {
      email: process.env.ADMIN_EMAIL_2 || 'admin002@example.com',
      nickname: process.env.ADMIN_NICKNAME_2 || 'admin002',
      password: process.env.ADMIN_PASSWORD_2 || '000000',
    },
    {
      email: process.env.ADMIN_EMAIL_3 || 'admin003@example.com',
      nickname: process.env.ADMIN_NICKNAME_3 || 'admin003',
      password: process.env.ADMIN_PASSWORD_3 || '000000',
    },
  ];

  await prisma.$transaction(async (tx) => {
    for (const admin of defaultAdmins) {
      const existingUser = await tx.user.findUnique({
        where: { email: admin.email },
      });

      if (existingUser) {
        console.info(`Admin account ${admin.email} already exists, skipping.`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(admin.password, 10);
      await tx.user.create({
        data: {
          email: admin.email,
          nickname: admin.nickname,
          password: hashedPassword,
          role: 'ADMIN',
        },
      });
      console.info(`Admin account ${admin.email} created successfully.`);
    }

    await tx.systemConfig.create({
      data: {
        key: 'admin_accounts_setup_completed',
        value: 'true',
      },
    });
  });

  console.info('Admin accounts seeding completed!');
}

async function main() {
  try {
    await seedAdminAccounts();
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });