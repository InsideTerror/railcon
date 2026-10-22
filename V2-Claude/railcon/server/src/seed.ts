import { prisma } from "./db.js";
import { ensureCannedOptions, seedDemoNetwork, seedUsers } from "./seedCore.js";

async function main() {
  await ensureCannedOptions();
  const creds = await seedUsers();
  await seedDemoNetwork();
  console.log("Canned options seeded.");
  if (creds) {
    console.log(`Users seeded -> driver 856 PIN ${creds.driver}, dispatcher 9001 PIN ${creds.dispatcher}, sysadmin 9999 PIN ${creds.sysadmin}`);
  } else {
    console.log("Users already exist, left untouched.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
