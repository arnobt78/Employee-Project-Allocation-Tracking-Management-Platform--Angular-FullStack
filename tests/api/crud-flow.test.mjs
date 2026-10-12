import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { sessionCookie, startApiServer, unwrap } from "./support/api-server.mjs";
import { LEGACY_ID_FLAG, createFakeDb, installFakeDb } from "./support/fake-db.mjs";

const db = createFakeDb();
installFakeDb(db);

let api;
let cookie;

async function request(action, { method = "GET", body, rawBody } = {}) {
  const response = await api.call(action, { method, body, rawBody, cookie });
  const json = await response.json().catch(() => null);
  return { status: response.status, json, data: unwrap(json) };
}

const list = async (action) => (await request(action)).data;
const post = (action, body) => request(action, { method: "POST", body });
const put = (action, body) => request(action, { method: "PUT", body });
const del = (action) => request(action, { method: "DELETE" });

/** Background notifications settle after the response; wait for a matching log row. */
async function waitForDelivery(predicate) {
  for (let i = 0; i < 100; i += 1) {
    const entry = [...db.tables.notificationLog.values()].find(predicate);
    if (entry) {
      return entry;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return null;
}

async function createEmployee(overrides = {}) {
  const { status, data } = await post("CreateEmployee", {
    employeeName: "Test Employee",
    emailId: "test.employee@example.com",
    contactNo: "123",
    ...overrides,
  });
  assert.equal(status, 201);
  return data;
}

async function createProject(overrides = {}) {
  const { status, data } = await post("CreateProject", {
    projectName: "Test Project",
    clientName: "Client",
    startDate: "2026-01-01",
    ...overrides,
  });
  assert.equal(status, 201);
  return data;
}

async function createAssignment(projectId, empId, overrides = {}) {
  const { status, data } = await post("CreateProjectEmployee", {
    projectId,
    empId,
    role: "Developer",
    isActive: "Y",
    allocationPct: 50,
    assignedDate: "2026-02-01",
    ...overrides,
  });
  assert.equal(status, 201);
  return data;
}

describe("CRUD HTTP flow", () => {
  before(async () => {
    api = await startApiServer();
    await db.seedUser({ username: "admin", password: "pw" });
    const login = await api.call("Login", {
      method: "POST",
      body: { username: "admin", password: "pw" },
    });
    assert.equal(login.status, 200);
    cookie = sessionCookie(login);
  });

  after(() => api.close());

  test("an empty database stays empty: no legacy data is imported", async () => {
    assert.deepEqual(await list("GetAllProjects"), []);
    assert.deepEqual(await list("GetAllProjectEmployees"), []);
  });

  describe("employees", () => {
    test("create assigns the next id and is listed", async () => {
      const before = await list("GetAllEmployees");
      const created = await createEmployee({ employeeName: "Create Me" });
      assert.ok(created.employeeId > Math.max(...before.map((e) => e.employeeId)));
      const after = await list("GetAllEmployees");
      assert.ok(after.some((e) => e.employeeId === created.employeeId && e.employeeName === "Create Me"));
    });

    test("update changes only the provided fields", async () => {
      const created = await createEmployee({ employeeName: "Old Name", title: "Engineer" });
      const { status, data } = await put(`UpdateEmployee/${created.employeeId}`, {
        employeeName: "New Name",
      });
      assert.equal(status, 200);
      assert.equal(data.employeeName, "New Name");
      assert.equal(data.title, "Engineer");
      assert.equal(db.tables.employee.get(created.employeeId).employeeName, "New Name");
    });

    test("delete removes the employee and their assignments", async () => {
      const employee = await createEmployee();
      const project = await createProject();
      const assignment = await createAssignment(project.projectId, employee.employeeId);

      const { status } = await del(`DeleteEmployee/${employee.employeeId}`);
      assert.equal(status, 200);
      assert.equal(db.tables.employee.has(employee.employeeId), false);
      assert.equal(db.tables.projectEmployee.has(assignment.empProjectId), false);
      assert.ok(db.tables.project.has(project.projectId));
    });

    test("missing name is a 400, unknown ids are 404, bad ids are 400", async () => {
      assert.equal((await post("CreateEmployee", { emailId: "x@y.io" })).status, 400);
      assert.equal((await put("UpdateEmployee/999999", { employeeName: "x" })).status, 404);
      assert.equal((await del("DeleteEmployee/999999")).status, 404);
      assert.equal((await del("DeleteEmployee/abc")).status, 400);
    });
  });

  describe("projects", () => {
    test("create assigns sequential ids and resolves the lead name", async () => {
      const lead = await createEmployee({ employeeName: "Lead Person" });
      const first = await createProject({ leadByEmpId: lead.employeeId });
      const second = await createProject();
      assert.equal(second.projectId, first.projectId + 1);
      assert.equal(first.employeeName, "Lead Person");
      assert.equal(first.approvalStatus, "draft");
    });

    test("update persists and GetProject returns the new values", async () => {
      const project = await createProject({ projectName: "Before" });
      const { status } = await put(`UpdateProject/${project.projectId}`, { projectName: "After" });
      assert.equal(status, 200);
      const fetched = await request(`GetProject/${project.projectId}`);
      assert.equal(fetched.status, 200);
      assert.equal(fetched.data.projectName, "After");
    });

    test("delete removes the project and its assignments only", async () => {
      const employee = await createEmployee();
      const doomed = await createProject();
      const kept = await createProject();
      const doomedAssignment = await createAssignment(doomed.projectId, employee.employeeId);
      const keptAssignment = await createAssignment(kept.projectId, employee.employeeId);

      assert.equal((await del(`DeleteProject/${doomed.projectId}`)).status, 200);
      assert.equal(db.tables.project.has(doomed.projectId), false);
      assert.equal(db.tables.projectEmployee.has(doomedAssignment.empProjectId), false);
      assert.ok(db.tables.projectEmployee.has(keptAssignment.empProjectId));
      assert.equal((await request(`GetProject/${doomed.projectId}`)).status, 404);
    });

    test("delete also removes assignments Prisma's deleteMany cannot see and reports the count", async () => {
      const employee = await createEmployee();
      const other = await createEmployee();
      const project = await createProject();
      const regular = await createAssignment(project.projectId, employee.employeeId);
      const legacy = await createAssignment(project.projectId, other.employeeId);
      db.tables.projectEmployee.get(legacy.empProjectId)[LEGACY_ID_FLAG] = true;

      const { status, json } = await del(`DeleteProject/${project.projectId}`);
      assert.equal(status, 200);
      assert.equal(json.data.deletedAssignments, 2);
      assert.equal(db.tables.projectEmployee.has(regular.empProjectId), false);
      assert.equal(db.tables.projectEmployee.has(legacy.empProjectId), false);
      const listed = await list("GetAllProjectEmployees");
      assert.equal(listed.some((item) => item.projectId === project.projectId), false);
      assert.equal(listed.some((item) => item.projectName === "Unknown Project"), false);
    });

    test("assignment lists never return rows whose project is gone", async () => {
      const employee = await createEmployee();
      const project = await createProject();
      const assignment = await createAssignment(project.projectId, employee.employeeId);
      db.tables.project.delete(project.projectId);
      const listed = await list("GetAllProjectEmployees");
      assert.equal(listed.some((item) => item.empProjectId === assignment.empProjectId), false);
    });

    test("archive keeps the project and its assignments; restore brings them back unchanged", async () => {
      const employee = await createEmployee();
      const project = await createProject();
      const assignment = await createAssignment(project.projectId, employee.employeeId, {
        allocationPct: 60,
      });

      const archived = await post(`ArchiveProject/${project.projectId}`);
      assert.equal(archived.status, 200);
      assert.ok(archived.data.archivedAt);
      assert.equal(archived.data.archivedBy, "admin user");
      assert.equal(archived.data.statusHistory.at(-1).comment, "Project archived");
      assert.ok(db.tables.projectEmployee.has(assignment.empProjectId));
      const listed = (await list("GetAllProjectEmployees")).find(
        (item) => item.empProjectId === assignment.empProjectId
      );
      assert.ok(listed.projectArchivedAt);

      const schedule = await list("GetSchedule");
      assert.equal(schedule.projectTimelines.some((p) => p.projectId === project.projectId), false);
      const dashboard = await list("GetDashboard");
      assert.ok(dashboard.archivedProject >= 1);

      const restored = await post(`RestoreProject/${project.projectId}`);
      assert.equal(restored.status, 200);
      assert.equal(restored.data.archivedAt, undefined);
      assert.equal(restored.data.statusHistory.at(-1).comment, "Project restored");
      const stored = db.tables.projectEmployee.get(assignment.empProjectId);
      assert.equal(stored.allocationPct, 60);
      assert.equal(stored.isActive, true);
      const again = await list("GetSchedule");
      const timeline = again.projectTimelines.find((p) => p.projectId === project.projectId);
      assert.equal(timeline.teamSize, 1);
      assert.equal(typeof timeline.readinessScore, "number");

      assert.equal((await post("ArchiveProject/999999")).status, 404);
      assert.equal((await post("RestoreProject/abc")).status, 400);
    });

    test("an archived project's team is read-only and its allocation frees capacity", async () => {
      const employee = await createEmployee();
      const other = await createEmployee();
      const archivedProject = await createProject();
      const liveProject = await createProject();
      const assignment = await createAssignment(archivedProject.projectId, employee.employeeId, {
        allocationPct: 70,
      });
      await post(`ArchiveProject/${archivedProject.projectId}`);

      const blockedCreate = await post("CreateProjectEmployee", {
        projectId: archivedProject.projectId,
        empId: other.employeeId,
      });
      assert.equal(blockedCreate.status, 409);
      assert.equal(blockedCreate.json.message, "Project is archived. Restore it before changing its team");
      assert.equal((await put(`UpdateProjectEmployee/${assignment.empProjectId}`, { role: "x" })).status, 409);
      assert.equal((await del(`DeleteProjectEmployee/${assignment.empProjectId}`)).status, 409);

      await createAssignment(liveProject.projectId, employee.employeeId, { allocationPct: 20 });
      const insights = await request(`GetProjectResources/${liveProject.projectId}`);
      const member = insights.data.assignments.find(
        (item) => item.employee.employeeId === employee.employeeId
      );
      assert.equal(member.employee.allocation.allocatedPct, 20);
      assert.equal(
        member.employee.activeAssignments.some((item) => item.projectId === archivedProject.projectId),
        false
      );
    });
  });

  describe("project lead", () => {
    test("creating a project with a lead assigns the lead once", async () => {
      const lead = await createEmployee({ employeeName: "Lead On Create" });
      const project = await createProject({ leadByEmpId: lead.employeeId });
      const rows = [...db.tables.projectEmployee.values()].filter(
        (row) => row.projectId === project.projectId
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].empId, lead.employeeId);
      assert.equal(rows[0].role, "Project Lead");
      assert.equal(rows[0].isActive, true);
    });

    test("changing the lead adds exactly one assignment and keeps the old lead's role", async () => {
      const first = await createEmployee();
      const second = await createEmployee();
      const project = await createProject({ leadByEmpId: first.employeeId });
      const teamOf = () =>
        [...db.tables.projectEmployee.values()].filter((row) => row.projectId === project.projectId);

      assert.equal((await put(`UpdateProject/${project.projectId}`, { leadByEmpId: second.employeeId })).status, 200);
      assert.equal(teamOf().length, 2);
      assert.equal(teamOf().find((row) => row.empId === first.employeeId).role, "Project Lead");
      assert.equal(teamOf().find((row) => row.empId === second.employeeId).role, "Project Lead");

      await put(`UpdateProject/${project.projectId}`, { leadByEmpId: second.employeeId });
      assert.equal(teamOf().length, 2);
    });

    test("an inactive lead assignment is reactivated instead of duplicated", async () => {
      const lead = await createEmployee();
      const project = await createProject();
      const assignment = await createAssignment(project.projectId, lead.employeeId, { isActive: "N" });

      await put(`UpdateProject/${project.projectId}`, { leadByEmpId: lead.employeeId });
      const stored = db.tables.projectEmployee.get(assignment.empProjectId);
      assert.equal(stored.isActive, true);
      assert.equal(stored.unassignedAt, null);
      assert.equal(stored.role, "Developer");
    });

    test("an archived project's lead cannot change, but other edits still save", async () => {
      const first = await createEmployee();
      const second = await createEmployee();
      const project = await createProject({ leadByEmpId: first.employeeId });
      await post(`ArchiveProject/${project.projectId}`);
      const teamSize = () =>
        [...db.tables.projectEmployee.values()].filter((row) => row.projectId === project.projectId).length;

      const changed = await put(`UpdateProject/${project.projectId}`, { leadByEmpId: second.employeeId });
      assert.equal(changed.status, 409);
      assert.equal(db.tables.project.get(project.projectId).leadByEmpId, first.employeeId);
      assert.equal(teamSize(), 1);

      const renamed = await put(`UpdateProject/${project.projectId}`, {
        projectName: "Renamed while archived",
        leadByEmpId: first.employeeId,
      });
      assert.equal(renamed.status, 200);
      assert.equal(teamSize(), 1);
    });

    test("a concurrent duplicate lead row is ignored, any other write failure is reported", async () => {
      const methods = db.prisma.projectEmployee;
      const originalCreate = methods.create;
      const failWith = (code) => {
        methods.create = async () => {
          throw Object.assign(new Error(`write failed (${code})`), { code });
        };
      };
      try {
        const project = await createProject();

        failWith("P2002");
        const duplicate = await put(`UpdateProject/${project.projectId}`, {
          leadByEmpId: (await createEmployee()).employeeId,
        });
        assert.equal(duplicate.status, 200);

        failWith("P2010");
        const failed = await put(`UpdateProject/${project.projectId}`, {
          leadByEmpId: (await createEmployee()).employeeId,
        });
        assert.equal(failed.status, 500);
      } finally {
        methods.create = originalCreate;
      }
    });

    test("an unknown lead is a 404 and writes nothing", async () => {
      const before = db.tables.project.size;
      const created = await post("CreateProject", { projectName: "Ghost lead", leadByEmpId: 999999 });
      assert.equal(created.status, 404);
      assert.equal(created.json.message, "Lead employee not found");
      assert.equal(db.tables.project.size, before);
      const project = await createProject();
      const updated = await put(`UpdateProject/${project.projectId}`, { leadByEmpId: 999999 });
      assert.equal(updated.status, 404);
      assert.equal(db.tables.project.get(project.projectId).leadByEmpId ?? null, null);
    });

    test("a project saved without overview content still returns overview arrays", async () => {
      const project = await createProject();
      assert.deepEqual(project.overview, { summary: "", objectives: [], successCriteria: [] });
      const fetched = (await list("GetAllProjects")).find((p) => p.projectId === project.projectId);
      assert.deepEqual(fetched.overview.objectives, []);
      assert.deepEqual(fetched.overview.successCriteria, []);
    });

    test("missing name is a 400 and unknown ids are 404", async () => {
      assert.equal((await post("CreateProject", { clientName: "x" })).status, 400);
      assert.equal((await put("UpdateProject/999999", { projectName: "x" })).status, 404);
      assert.equal((await del("DeleteProject/999999")).status, 404);
    });
  });

  describe("assignments", () => {
    test("create, update and delete an assignment", async () => {
      const employee = await createEmployee({ employeeName: "Assignee" });
      const project = await createProject({ projectName: "Assigned Project" });
      const created = await createAssignment(project.projectId, employee.employeeId);
      assert.equal(created.employeeName, "Assignee");
      assert.equal(created.projectName, "Assigned Project");
      assert.equal(created.isActive, "Y");

      const updated = await put(`UpdateProjectEmployee/${created.empProjectId}`, {
        role: "Lead",
        allocationPct: 80,
        isActive: "N",
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.data.role, "Lead");
      assert.equal(updated.data.allocationPct, 80);
      assert.equal(updated.data.isActive, "N");

      const listed = (await list("GetAllProjectEmployees")).find(
        (item) => item.empProjectId === created.empProjectId
      );
      assert.equal(listed.role, "Lead");

      assert.equal((await del(`DeleteProjectEmployee/${created.empProjectId}`)).status, 200);
      assert.equal(db.tables.projectEmployee.has(created.empProjectId), false);
    });

    test("deactivating stamps unassignedAt and reactivating clears it", async () => {
      const employee = await createEmployee();
      const project = await createProject();
      const assignment = await createAssignment(project.projectId, employee.employeeId);
      const id = assignment.empProjectId;
      assert.equal(assignment.unassignedAt ?? null, null);

      const before = Date.now();
      const deactivated = await put(`UpdateProjectEmployee/${id}`, { isActive: "N" });
      assert.equal(deactivated.status, 200);
      const stamped = db.tables.projectEmployee.get(id).unassignedAt;
      assert.ok(stamped instanceof Date && stamped.getTime() >= before - 1000);
      assert.ok(deactivated.data.unassignedAt);

      await put(`UpdateProjectEmployee/${id}`, { isActive: "N", role: "Still inactive" });
      assert.equal(db.tables.projectEmployee.get(id).unassignedAt.getTime(), stamped.getTime());

      const reactivated = await put(`UpdateProjectEmployee/${id}`, { isActive: "Y" });
      assert.equal(reactivated.status, 200);
      assert.equal(db.tables.projectEmployee.get(id).unassignedAt, null);

      const explicit = await put(`UpdateProjectEmployee/${id}`, {
        isActive: "N",
        unassignedAt: "2026-03-15",
      });
      assert.equal(explicit.status, 200);
      assert.equal(
        db.tables.projectEmployee.get(id).unassignedAt.toISOString().slice(0, 10),
        "2026-03-15"
      );
      assert.equal((await put("UpdateProjectEmployee/999999", { isActive: "N" })).status, 404);
    });

    test("missing ids are a 400; unknown project or employee is a 404", async () => {
      const employee = await createEmployee();
      const project = await createProject();
      assert.equal((await post("CreateProjectEmployee", { empId: employee.employeeId })).status, 400);
      assert.equal((await post("CreateProjectEmployee", { projectId: project.projectId })).status, 400);

      const before = db.tables.projectEmployee.size;
      assert.equal(
        (await post("CreateProjectEmployee", { projectId: 999999, empId: employee.employeeId })).status,
        404
      );
      assert.equal(
        (await post("CreateProjectEmployee", { projectId: project.projectId, empId: 999999 })).status,
        404
      );
      assert.equal(db.tables.projectEmployee.size, before);
    });

    test("an employee can be assigned to a project only once", async () => {
      const employee = await createEmployee();
      const other = await createEmployee();
      const project = await createProject();
      const first = await createAssignment(project.projectId, employee.employeeId);
      const second = await createAssignment(project.projectId, other.employeeId);

      const duplicate = await post("CreateProjectEmployee", {
        projectId: project.projectId,
        empId: employee.employeeId,
      });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.json.message, "Employee is already assigned to this project");
      const moved = await put(`UpdateProjectEmployee/${second.empProjectId}`, { empId: employee.employeeId });
      assert.equal(moved.status, 409);
      assert.equal(db.tables.projectEmployee.get(second.empProjectId).empId, other.employeeId);
      assert.equal(
        (await put(`UpdateProjectEmployee/${first.empProjectId}`, { empId: employee.employeeId })).status,
        200
      );
    });

    test("unknown assignment ids are 404", async () => {
      assert.equal((await put("UpdateProjectEmployee/999999", { role: "x" })).status, 404);
      assert.equal((await del("DeleteProjectEmployee/999999")).status, 404);
    });

    test("moving an assignment to an unknown project or employee is a 404 and changes nothing", async () => {
      const employee = await createEmployee();
      const project = await createProject();
      const assignment = await createAssignment(project.projectId, employee.employeeId);
      const id = assignment.empProjectId;
      const stored = () => db.tables.projectEmployee.get(id);

      const badProject = await put(`UpdateProjectEmployee/${id}`, { projectId: 999999, role: "Moved" });
      assert.equal(badProject.status, 404);
      assert.equal(badProject.json.message, "Project not found");
      const badEmployee = await put(`UpdateProjectEmployee/${id}`, { empId: 999999, role: "Moved" });
      assert.equal(badEmployee.status, 404);
      assert.equal(badEmployee.json.message, "Employee not found");
      assert.equal(stored().projectId, project.projectId);
      assert.equal(stored().empId, employee.employeeId);
      assert.equal(stored().role, "Developer");

      const other = await createProject();
      const moved = await put(`UpdateProjectEmployee/${id}`, { projectId: other.projectId });
      assert.equal(moved.status, 200);
      assert.equal(stored().projectId, other.projectId);
    });

    test("a missing assignment is reported before a missing project", async () => {
      const response = await put("UpdateProjectEmployee/999999", { projectId: 999998 });
      assert.equal(response.status, 404);
      assert.equal(response.json.message, "Project employee not found");
    });

    test("non-integer project or employee ids are a 400 and write nothing", async () => {
      const employee = await createEmployee();
      const project = await createProject();
      const assignment = await createAssignment(project.projectId, employee.employeeId);
      const before = db.tables.projectEmployee.size;

      const created = await post("CreateProjectEmployee", { projectId: "abc", empId: employee.employeeId });
      assert.equal(created.status, 400);
      assert.equal(created.json.message, "projectId must be a positive whole number");
      const moved = await put(`UpdateProjectEmployee/${assignment.empProjectId}`, { empId: 1.5 });
      assert.equal(moved.status, 400);
      assert.equal(moved.json.message, "empId must be a positive whole number");

      assert.equal(db.tables.projectEmployee.size, before);
      assert.equal(db.tables.projectEmployee.get(assignment.empProjectId).empId, employee.employeeId);
    });
  });

  test("non-integer path ids are a 400 on every CRUD route", async () => {
    for (const [method, action] of [
      ["GET", "GetProject/1.5"],
      ["PUT", "UpdateEmployee/1.5"],
      ["PUT", "UpdateProject/-1"],
      ["PUT", "UpdateProjectEmployee/abc"],
      ["DELETE", "DeleteEmployee/1.5"],
      ["DELETE", "DeleteProject/0"],
      ["DELETE", "DeleteProjectEmployee/2.5"],
    ]) {
      const response = await request(action, { method, body: method === "PUT" ? {} : undefined });
      assert.equal(response.status, 400, `${method} ${action}`);
    }
  });

  test("a malformed JSON body is a 400, writes nothing and is not logged as a server error", async (t) => {
    const serverErrors = t.mock.method(console, "error", () => {});
    const employeesBefore = db.tables.employee.size;
    const created = await request("CreateEmployee", { method: "POST", rawBody: "{bad json" });
    assert.equal(created.status, 400);
    assert.equal(created.json.message, "Invalid JSON body");
    assert.equal(db.tables.employee.size, employeesBefore);

    const updated = await request("UpdateProjectEmployee/1", { method: "PUT", rawBody: "{" });
    assert.equal(updated.status, 400);
    assert.equal(updated.json.message, "Invalid JSON body");
    assert.equal(serverErrors.mock.callCount(), 0);
  });

  test("API documentation lists the CRUD validation responses", async () => {
    const { status, json } = await request("GetApiDocumentation");
    assert.equal(status, 200);
    const listed = (method, path) =>
      json.endpoints[method]
        .find((e) => e.path === path)
        .errorResponses.map((e) => `${e.status} ${e.body.message}`);
    const expectations = {
      "POST CreateEmployee": ["400 employeeName is required to create an employee", "400 Invalid JSON body"],
      "POST CreateProject": ["400 projectName is required to create a project", "400 Invalid JSON body"],
      "POST CreateProjectEmployee": [
        "400 projectId must be a positive whole number",
        "404 Project not found",
        "404 Employee not found",
        "400 Invalid JSON body",
      ],
      "PUT UpdateEmployee/{id}": ["400 Invalid employee identifier", "400 Invalid JSON body"],
      "PUT UpdateProject/{id}": ["400 Invalid project identifier", "400 Invalid JSON body"],
      "PUT UpdateProjectEmployee/{id}": [
        "404 Project employee not found",
        "404 Project not found",
        "404 Employee not found",
        "400 Invalid JSON body",
      ],
      "DELETE DeleteProjectEmployee/{id}": ["400 Invalid project employee identifier"],
    };
    for (const [key, expected] of Object.entries(expectations)) {
      const [method, path] = key.split(" ");
      const responses = listed(method, path);
      for (const line of expected) {
        assert.ok(responses.includes(line), `${key}: ${line}`);
      }
    }
  });

  test("every CRUD route requires a session", async () => {
    const routes = [
      ["POST", "CreateEmployee"],
      ["PUT", "UpdateEmployee/1"],
      ["DELETE", "DeleteEmployee/1"],
      ["POST", "CreateProject"],
      ["PUT", "UpdateProject/1"],
      ["DELETE", "DeleteProject/1"],
      ["POST", "CreateProjectEmployee"],
      ["PUT", "UpdateProjectEmployee/1"],
      ["DELETE", "DeleteProjectEmployee/1"],
      ["GET", "GetAllEmployees"],
      ["GET", "GetAllProjects"],
      ["GET", "GetAllProjectEmployees"],
    ];
    const employeesBefore = db.tables.employee.size;
    for (const [method, action] of routes) {
      const response = await api.call(action, { method, body: method === "GET" ? undefined : {} });
      assert.equal(response.status, 401, `${method} ${action}`);
    }
    assert.equal(db.tables.employee.size, employeesBefore);
  });

  test("the welcome email to a test-domain address is dropped and logged as skipped", async () => {
    const employee = await createEmployee({ emailId: "welcome@example.com" });
    const entry = await waitForDelivery(
      (row) => row.event === "employee_created" && row.entityId === employee.employeeId
    );
    assert.ok(entry, "delivery was recorded");
    assert.equal(entry.status, "skipped");
    assert.equal(entry.recipientCount, 0);
    assert.equal(
      [...db.tables.notificationLog.values()].filter((row) => row.status === "failed").length,
      0
    );
  });
});
