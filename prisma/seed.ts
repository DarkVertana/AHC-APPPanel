import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Default admin credentials
  const adminEmail = 'akshay@alternatehealthclub.com';
  const adminUsername = 'akshaysihag';
  const adminPassword = 'Gsarena27ahcinc.df@856';

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('ℹ️  Admin user already exists, skipping creation.');
    console.log(`   Email: ${existingAdmin.email}`);
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: adminUsername,
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
    },
  });

  console.log('✅ Default admin user created successfully!');
  console.log(`   User ID: ${admin.id}`);
  console.log(`   Username: ${admin.name}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role: ${admin.role}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
