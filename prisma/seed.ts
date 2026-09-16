/**
 * Database Seed Script for employee-management
 *
 * This script migrates data from JSON files to MongoDB database.
 *
 * Migration Status: ✅ IN PROGRESS (December 31, 2025)
 * - Migrating from MongoDB Atlas to Hetzner VPS MongoDB
 *
 * Usage:
 *   npm run db:seed
 *   or: npx tsx prisma/seed.ts
 *
 * Note: Uses MongoDB native driver to bypass Prisma's replica set requirement.
 * This script is safe to run multiple times - it uses upsert operations.
 */

import { MongoClient } from "mongodb";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });

// MongoDB connection URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Repo dataset/ (Atlas-style exports use employee-management.* prefix)
const JSON_DIR = path.join(process.cwd(), "dataset");

function datasetPath(baseName: string): string {
  const prefixed = path.join(JSON_DIR, `employee-management.${baseName}`);
  if (fs.existsSync(prefixed)) {
    return prefixed;
  }
  return path.join(JSON_DIR, baseName);
}


// MongoDB Extended JSON helpers
function parseMongoDBExtendedJSON(value: any): any {
  if (value && typeof value === "object") {
    // Handle MongoDB extended JSON date format: { "$date": "2024-10-04T19:48:57.118Z" }
    if ("$date" in value) {
      return new Date(value.$date);
    }
    // Handle MongoDB extended JSON number format: { "$numberLong": "1728074791" }
    if ("$numberLong" in value) {
      return parseInt(value.$numberLong, 10);
    }
    // Handle MongoDB extended JSON number format: { "$numberInt": "5" }
    if ("$numberInt" in value) {
      return parseInt(value.$numberInt, 10);
    }
    // Handle MongoDB extended JSON ObjectId format: { "$oid": "6915278f2ea0c14829bb978a" }
    if ("$oid" in value) {
      return value.$oid;
    }
    // Recursively parse nested objects/arrays
    if (Array.isArray(value)) {
      return value.map(parseMongoDBExtendedJSON);
    }
    const newObj: { [key: string]: any } = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        newObj[key] = parseMongoDBExtendedJSON(value[key]);
      }
    }
    return newObj;
  }
  return value;
}

async function parseJSON(filePath: string): Promise<any[]> {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  JSON file not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  if (!content.trim()) {
    console.warn(`⚠️  JSON file is empty: ${filePath}`);
    return [];
  }

  try {
    const data = JSON.parse(content);
    const array = Array.isArray(data) ? data : [data];
    // Parse MongoDB extended JSON format
    return array.map((item: any) => parseMongoDBExtendedJSON(item));
  } catch (error) {
    console.error(`❌ Error parsing JSON file ${filePath}:`, error);
    return [];
  }
}

// Seed functions using MongoDB native driver
async function seedCounter(db: any) {
  console.log("🌱 Seeding Counter...");
  const counters = await parseJSON(datasetPath("Counter.json"));

  if (counters.length === 0) {
    console.log("⚠️  No counters to seed");
    return;
  }

  const collection = db.collection("Counter");
  let successCount = 0;

  for (const counter of counters) {
    try {
      await collection.updateOne(
        { key: counter.key },
        {
          $set: {
            _id: counter._id,
            key: counter.key,
            value: counter.value,
            createdAt: counter.createdAt ? new Date(counter.createdAt) : new Date(),
            updatedAt: counter.updatedAt ? new Date(counter.updatedAt) : new Date(),
          },
        },
        { upsert: true }
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Error seeding counter ${counter.key}:`, error);
    }
  }
  console.log(`✅ Seeded ${successCount}/${counters.length} counters`);
}

async function seedDepartmentParent(db: any) {
  console.log("🌱 Seeding DepartmentParent...");
  const departments = await parseJSON(datasetPath("DepartmentParent.json"));

  if (departments.length === 0) {
    console.log("⚠️  No department parents to seed");
    return;
  }

  const collection = db.collection("DepartmentParent");
  let successCount = 0;

  for (const dept of departments) {
    try {
      await collection.updateOne(
        { departmentId: dept.departmentId },
        {
          $set: {
            _id: dept._id,
            departmentId: dept.departmentId,
            departmentName: dept.departmentName,
            departmentLogo: dept.departmentLogo || null,
            description: dept.description || null,
            leadContact: dept.leadContact || null,
            leadEmail: dept.leadEmail || null,
            leadPhone: dept.leadPhone || null,
            createdAt: dept.createdAt ? new Date(dept.createdAt) : new Date(),
            updatedAt: dept.updatedAt ? new Date(dept.updatedAt) : new Date(),
          },
        },
        { upsert: true }
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Error seeding department parent ${dept.departmentId}:`, error);
    }
  }
  console.log(`✅ Seeded ${successCount}/${departments.length} department parents`);
}

async function seedDepartmentChild(db: any) {
  console.log("🌱 Seeding DepartmentChild...");
  const departments = await parseJSON(datasetPath("DepartmentChild.json"));

  if (departments.length === 0) {
    console.log("⚠️  No department children to seed");
    return;
  }

  const collection = db.collection("DepartmentChild");
  let successCount = 0;

  for (const dept of departments) {
    try {
      await collection.updateOne(
        { childDeptId: dept.childDeptId },
        {
          $set: {
            _id: dept._id,
            childDeptId: dept.childDeptId,
            departmentName: dept.departmentName,
            parentDeptId: dept.parentDeptId,
            description: dept.description || null,
            createdAt: dept.createdAt ? new Date(dept.createdAt) : new Date(),
            updatedAt: dept.updatedAt ? new Date(dept.updatedAt) : new Date(),
          },
        },
        { upsert: true }
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Error seeding department child ${dept.childDeptId}:`, error);
    }
  }
  console.log(`✅ Seeded ${successCount}/${departments.length} department children`);
}

async function seedEmployee(db: any) {
  console.log("🌱 Seeding Employee...");
  const employees = await parseJSON(datasetPath("Employee.json"));

  if (employees.length === 0) {
    console.log("⚠️  No employees to seed");
    return;
  }

  const collection = db.collection("Employee");
  let successCount = 0;

  for (const emp of employees) {
    try {
      await collection.updateOne(
        { employeeId: emp.employeeId },
        {
          $set: {
            _id: emp._id,
            employeeId: emp.employeeId,
            employeeName: emp.employeeName,
            contactNo: emp.contactNo || null,
            emailId: emp.emailId || null,
            deptId: emp.deptId || null,
            department: emp.department || null,
            password: null,
            gender: emp.gender || null,
            role: emp.role || null,
            title: emp.title || null,
            avatarUrl: emp.avatarUrl || null,
            location: emp.location || null,
            timezone: emp.timezone || null,
            employmentType: emp.employmentType || null,
            managerId: emp.managerId || null,
            hireDate: emp.hireDate ? new Date(emp.hireDate) : null,
            bio: emp.bio || null,
            about: emp.about || null,
            notes: emp.notes || null,
            tags: emp.tags || [],
            skills: emp.skills || [],
            certifications: emp.certifications || [],
            interests: emp.interests || [],
            languages: emp.languages || [],
            socialLinks: emp.socialLinks || null,
            workPreferences: emp.workPreferences || null,
            availability: emp.availability || null,
            preferences: emp.preferences || null,
            performanceSnapshot: emp.performanceSnapshot || null,
            documents: emp.documents || null,
            customFields: emp.customFields || null,
            createdAt: emp.createdAt ? new Date(emp.createdAt) : new Date(),
            updatedAt: emp.updatedAt ? new Date(emp.updatedAt) : new Date(),
            isActive: emp.isActive !== undefined ? emp.isActive : true,
            lastActiveAt: emp.lastActiveAt ? new Date(emp.lastActiveAt) : null,
          },
        },
        { upsert: true }
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Error seeding employee ${emp.employeeId}:`, error);
    }
  }
  console.log(`✅ Seeded ${successCount}/${employees.length} employees`);
}

async function seedProject(db: any) {
  console.log("🌱 Seeding Project...");
  const projects = await parseJSON(datasetPath("Project.json"));

  if (projects.length === 0) {
    console.log("⚠️  No projects to seed");
    return;
  }

  const collection = db.collection("Project");
  let successCount = 0;

  for (const project of projects) {
    try {
      await collection.updateOne(
        { projectId: project.projectId },
        {
          $set: {
            _id: project._id,
            projectId: project.projectId,
            projectName: project.projectName,
            clientName: project.clientName || null,
            clientIndustry: project.clientIndustry || null,
            startDate: project.startDate ? new Date(project.startDate) : null,
            endDate: project.endDate ? new Date(project.endDate) : null,
            leadByEmpId: project.leadByEmpId || null,
            sponsorEmpId: project.sponsorEmpId || null,
            contactPerson: project.contactPerson || null,
            contactNo: project.contactNo || null,
            emailId: project.emailId || null,
            contactTitle: project.contactTitle || null,
            contactNotes: project.contactNotes || null,
            overview: project.overview || null,
            scope: project.scope || null,
            successMetrics: project.successMetrics || null,
            status: project.status || "draft",
            statusReason: project.statusReason || null,
            statusHistory: project.statusHistory || null,
            timeline: project.timeline || null,
            milestones: project.milestones || null,
            categories: project.categories || [],
            tags: project.tags || [],
            focusAreas: project.focusAreas || [],
            blockers: project.blockers || null,
            risks: project.risks || null,
            riskRegister: project.riskRegister || null,
            budget: project.budget || null,
            financials: project.financials || null,
            resourcesPlan: project.resourcesPlan || null,
            readinessChecklist: project.readinessChecklist || null,
            readinessScore: project.readinessScore || null,
            approvalStatus: project.approvalStatus || "draft",
            approvalRequestedAt: project.approvalRequestedAt ? new Date(project.approvalRequestedAt) : null,
            approvalRequestedBy: project.approvalRequestedBy || null,
            approvalResolvedAt: project.approvalResolvedAt ? new Date(project.approvalResolvedAt) : null,
            approvalResolvedBy: project.approvalResolvedBy || null,
            approvalReason: project.approvalReason || null,
            approvalNotes: project.approvalNotes || null,
            reviewerComments: project.reviewerComments || null,
            progress: project.progress || null,
            health: project.health || null,
            documents: project.documents || null,
            externalLinks: project.externalLinks || null,
            aiGeneratedInsights: project.aiGeneratedInsights || null,
            cmsContentRefs: project.cmsContentRefs || [],
            lastSyncedAt: project.lastSyncedAt ? new Date(project.lastSyncedAt) : null,
            stageGate: project.stageGate || null,
            governance: project.governance || null,
            communicationPlan: project.communicationPlan || null,
            createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
            updatedAt: project.updatedAt ? new Date(project.updatedAt) : new Date(),
            archivedAt: project.archivedAt ? new Date(project.archivedAt) : null,
          },
        },
        { upsert: true }
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Error seeding project ${project.projectId}:`, error);
    }
  }
  console.log(`✅ Seeded ${successCount}/${projects.length} projects`);
}

async function seedProjectEmployee(db: any) {
  console.log("🌱 Seeding ProjectEmployee...");
  const projectEmployees = await parseJSON(datasetPath("ProjectEmployee.json"));

  if (projectEmployees.length === 0) {
    console.log("⚠️  No project employees to seed");
    return;
  }

  const collection = db.collection("ProjectEmployee");
  let successCount = 0;

  for (const projEmp of projectEmployees) {
    try {
      await collection.updateOne(
        { empProjectId: projEmp.empProjectId },
        {
          $set: {
            _id: projEmp._id,
            empProjectId: projEmp.empProjectId,
            projectId: projEmp.projectId,
            empId: projEmp.empId,
            assignedDate: projEmp.assignedDate ? new Date(projEmp.assignedDate) : null,
            role: projEmp.role || null,
            isActive: projEmp.isActive !== undefined ? projEmp.isActive : true,
            allocationPct: projEmp.allocationPct || null,
            billable: projEmp.billable !== undefined ? projEmp.billable : null,
            billingRate: projEmp.billingRate || null,
            costRate: projEmp.costRate || null,
            notes: projEmp.notes || null,
            responsibilities: projEmp.responsibilities || [],
            skillsApplied: projEmp.skillsApplied || [],
            toolsUsed: projEmp.toolsUsed || [],
            schedule: projEmp.schedule || null,
            contribution: projEmp.contribution || null,
            createdAt: projEmp.createdAt ? new Date(projEmp.createdAt) : new Date(),
            updatedAt: projEmp.updatedAt ? new Date(projEmp.updatedAt) : new Date(),
            unassignedAt: projEmp.unassignedAt ? new Date(projEmp.unassignedAt) : null,
          },
        },
        { upsert: true }
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Error seeding project employee ${projEmp.empProjectId}:`, error);
    }
  }
  console.log(`✅ Seeded ${successCount}/${projectEmployees.length} project employees`);
}

async function main() {
  console.log("🚀 Starting database seed...\n");

  const client = new MongoClient(DATABASE_URL);

  try {
    // Connect to MongoDB
    await client.connect();
    console.log("✅ Connected to MongoDB\n");

    // Get database (extract database name from connection string)
    const dbName =
      DATABASE_URL.split("/").pop()?.split("?")[0] || "employee_management_db";
    const db = client.db(dbName);

    // Seed in order to maintain relationships
    await seedCounter(db);
    await seedDepartmentParent(db);
    await seedDepartmentChild(db);
    await seedEmployee(db);
    await seedProject(db);
    await seedProjectEmployee(db);

    console.log("\n✨ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

