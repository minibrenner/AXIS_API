import { basePrisma } from "../src/prisma/client";

async function main() {
  const sessions = await basePrisma.session.findMany({
    select: {
      id: true,
      tenantId: true,
      userAgent: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  console.log(JSON.stringify(sessions, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
