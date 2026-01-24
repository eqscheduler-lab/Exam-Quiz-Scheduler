import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcryptjs";

async function seed() {
  const password = await bcrypt.hash("password123", 10);
  
  const demoUsers = [
    { username: "teacher", password, role: "TEACHER", name: "Demo Teacher", email: "teacher@example.com" },
    { username: "admin", password, role: "ADMIN", name: "Demo Admin", email: "admin@example.com" },
    { username: "coordinator", password, role: "COORDINATOR", name: "Demo Coordinator", email: "coordinator@example.com" },
    { username: "principal", password, role: "PRINCIPAL", name: "Demo Principal", email: "principal@example.com" },
    { username: "vice_principal", password, role: "VICE_PRINCIPAL", name: "Demo Vice Principal", email: "vp@example.com" },
    { username: "teacher1", password, role: "TEACHER", name: "Teacher One", email: "keating@school.com" },
    { username: "teacher2", password, role: "TEACHER", name: "Teacher Two", email: "klump@school.com" },
  ];

  console.log("Seeding demo accounts...");
  
  for (const user of demoUsers) {
    try {
      await db.insert(users).values(user).onConflictDoUpdate({
        target: users.username,
        set: { password: user.password, role: user.role, name: user.name, email: user.email }
      });
      console.log(`Created/Updated user: ${user.username}`);
    } catch (e) {
      console.error(`Failed to seed ${user.username}:`, e);
    }
  }
  
  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch(console.error);
