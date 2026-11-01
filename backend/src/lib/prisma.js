
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

// Read PostgreSQL connection string
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from the .env file");
}

// Create PostgreSQL adapter
const adapter = new PrismaPg({
  connectionString,
});

// Initialize Prisma Client
export const prisma = new PrismaClient({
  adapter,
});
