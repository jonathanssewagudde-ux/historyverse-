/**
 * Reference data that the application needs to function: media licences and top-level
 * categories. Idempotent (safe to run repeatedly). Contains no historical claims and no users.
 *
 *   pnpm db:seed
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const CC = "https://creativecommons.org";

/**
 * `publishable` is deliberately conservative. HISTORYVERSE publishes on YouTube and edits images
 * (crops, pans, captions), so NonCommercial and NoDerivatives licences are not publishable.
 */
export const licenses: Prisma.MediaLicenseCreateInput[] = [
  {
    code: "PD",
    name: "Public domain",
    family: "PUBLIC_DOMAIN",
    url: `${CC}/publicdomain/mark/1.0/`,
    requiresAttribution: false,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    publishable: true,
  },
  {
    code: "CC0-1.0",
    name: "CC0 1.0 Universal",
    family: "CC0",
    url: `${CC}/publicdomain/zero/1.0/`,
    requiresAttribution: false,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    publishable: true,
  },
  {
    code: "CC-BY-4.0",
    name: "CC BY 4.0",
    family: "CC_BY",
    url: `${CC}/licenses/by/4.0/`,
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    publishable: true,
  },
  {
    code: "CC-BY-3.0",
    name: "CC BY 3.0",
    family: "CC_BY",
    url: `${CC}/licenses/by/3.0/`,
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    publishable: true,
  },
  {
    code: "CC-BY-2.0",
    name: "CC BY 2.0",
    family: "CC_BY",
    url: `${CC}/licenses/by/2.0/`,
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    publishable: true,
  },
  {
    code: "CC-BY-SA-4.0",
    name: "CC BY-SA 4.0",
    family: "CC_BY_SA",
    url: `${CC}/licenses/by-sa/4.0/`,
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    requiresShareAlike: true,
    publishable: true,
  },
  {
    code: "CC-BY-SA-3.0",
    name: "CC BY-SA 3.0",
    family: "CC_BY_SA",
    url: `${CC}/licenses/by-sa/3.0/`,
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    requiresShareAlike: true,
    publishable: true,
  },
  {
    code: "CC-BY-SA-2.0",
    name: "CC BY-SA 2.0",
    family: "CC_BY_SA",
    url: `${CC}/licenses/by-sa/2.0/`,
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    requiresShareAlike: true,
    publishable: true,
  },
  {
    code: "CC-BY-NC-4.0",
    name: "CC BY-NC 4.0",
    family: "CC_BY_NC",
    url: `${CC}/licenses/by-nc/4.0/`,
    requiresAttribution: true,
    allowsCommercialUse: false,
    allowsDerivatives: true,
    publishable: false,
  },
  {
    code: "CC-BY-NC-SA-4.0",
    name: "CC BY-NC-SA 4.0",
    family: "CC_BY_NC",
    url: `${CC}/licenses/by-nc-sa/4.0/`,
    requiresAttribution: true,
    allowsCommercialUse: false,
    allowsDerivatives: true,
    requiresShareAlike: true,
    publishable: false,
  },
  {
    code: "CC-BY-ND-4.0",
    name: "CC BY-ND 4.0",
    family: "CC_BY_ND",
    url: `${CC}/licenses/by-nd/4.0/`,
    requiresAttribution: true,
    allowsCommercialUse: true,
    allowsDerivatives: false,
    publishable: false,
  },
  {
    code: "CC-BY-NC-ND-4.0",
    name: "CC BY-NC-ND 4.0",
    family: "CC_BY_ND",
    url: `${CC}/licenses/by-nc-nd/4.0/`,
    requiresAttribution: true,
    allowsCommercialUse: false,
    allowsDerivatives: false,
    publishable: false,
  },
  {
    code: "HV-ORIGINAL",
    name: "HISTORYVERSE original",
    family: "OWN_WORK",
    requiresAttribution: false,
    allowsCommercialUse: true,
    allowsDerivatives: true,
    publishable: true,
  },
  {
    code: "RIGHTS-RESERVED",
    name: "All rights reserved",
    family: "RIGHTS_RESERVED",
    requiresAttribution: true,
    allowsCommercialUse: false,
    allowsDerivatives: false,
    publishable: false,
  },
  {
    code: "UNKNOWN",
    name: "Unknown / not yet determined",
    family: "UNKNOWN",
    requiresAttribution: true,
    allowsCommercialUse: false,
    allowsDerivatives: false,
    publishable: false,
  },
];

export const categories = [
  { slug: "countries-and-territories", name: "Countries and Territories" },
  { slug: "political-leaders", name: "Presidents and Political Leaders" },
  { slug: "royalty-and-dynasties", name: "Kings, Queens and Royal Dynasties" },
  { slug: "kingdoms-and-empires", name: "Kingdoms and Empires" },
  { slug: "ancient-civilizations", name: "Ancient Civilizations" },
  { slug: "famous-people", name: "Famous People" },
  { slug: "historical-events", name: "Historical Events" },
  { slug: "everyday-things", name: "History of Everyday Things" },
  { slug: "technology", name: "History of Technology" },
  { slug: "great-african-kingdoms", name: "Great African Kingdoms" },
  { slug: "historical-mysteries", name: "Historical Mysteries" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    for (const license of licenses) {
      await db.mediaLicense.upsert({
        where: { code: license.code },
        create: license,
        update: license,
      });
    }
    for (const [position, category] of categories.entries()) {
      await db.category.upsert({
        where: { slug: category.slug },
        create: { ...category, position },
        update: { name: category.name, position },
      });
    }
    console.warn(`Seeded ${licenses.length} media licences and ${categories.length} categories.`);
  } finally {
    await db.$disconnect();
  }
}

// Run only when executed directly, so tests can import the reference data.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ""))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
