import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { sessionCookie, startApiServer, unwrap } from "./support/api-server.mjs";
import { createFakeDb, installFakeDb } from "./support/fake-db.mjs";

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

  test("seed data is bootstrapped once into an empty database", async () => {
    const employees = await list("GetAllEmployees");
    const projects = await list("GetAllProjects");
    assert.ok(employees.length > 0);
    assert.ok(projects.length > 0);
    assert.deepEqual(
      employees.map((e) => e.employeeId),
      [...employees.map((e) => e.employeeId)].sort((a, b) => a - b)
    );
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
