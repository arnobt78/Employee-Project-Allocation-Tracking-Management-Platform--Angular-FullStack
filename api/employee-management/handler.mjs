import { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import {
  buildDashboardSnapshot,
  buildScheduleData,
  buildApiStatus,
  createEmployee,
  createProject,
  createProjectEmployee,
  deleteEmployee,
  deleteProject,
  deleteProjectEmployee,
  getProject as getProjectById,
  listChildDepartmentsByParent,
  listEmployees,
  listParentDepartments,
  listProjectEmployees,
  updateEmployee,
  updateProject,
  updateProjectEmployee,
  listProjects,
  transitionProjectApproval,
  addProjectReviewerComment,
  resolveProjectReviewerComment,
  getProjectResourceInsights,
  fetchContentfulBrief,
  generateOverviewDraft,
  getProjectStakeholderEmails,
} from "./repository.mjs";
import {
  sendNotification,
  buildNotificationTemplate,
} from "./notifications.mjs";
import { prisma } from "../_lib/prisma-client.mjs";
import { logRequest } from "./monitoring.mjs";
import { parseLoginCredentials } from "../_lib/validation/auth.schema.mjs";
import { captureApiException } from "../_lib/sentry/server.mjs";
import {
  authenticateUser,
  clearLoginAttempts,
  clearSessionCookie,
  createSession,
  deleteSessionByToken,
  getSessionFromRequest,
  isLoginRateLimited,
  isPublicAction,
  listDemoAccounts,
  parseCookies,
  recordFailedLogin,
  requireAuth,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "./auth.mjs";

function sendJson(response, statusCode, body, statusCodeRef = null) {
  if (!(response instanceof ServerResponse)) {
    throw new Error("Invalid response object");
  }
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
  // Update status code reference if provided
  if (statusCodeRef && typeof statusCodeRef === "object") {
    statusCodeRef.value = statusCode;
  }
  return statusCode;
}

function createApiResponse(result, message, data = null) {
  return { result, message, data };
}

async function readRequestBody(request) {
  if (!(request instanceof IncomingMessage)) {
    throw new Error("Invalid request object");
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return null;
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch (error) {
    throw new Error("Invalid JSON body");
  }
}

async function notifyApprovalChange(project, action) {
  try {
    if (!project) {
      return;
    }

    const projectSpecificRecipients = await getProjectStakeholderEmails(
      project.projectId
    );

    const to = new Set(projectSpecificRecipients.to);
    const cc = new Set(projectSpecificRecipients.cc);
    const bcc = new Set(projectSpecificRecipients.bcc);

    const defaults =
      process.env.NOTIFY_APPROVAL_TO?.split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) ?? [];
    defaults.forEach((email) => to.add(email));

    if (!to.size && !cc.size && !bcc.size) {
            return;
    }

    const subject = buildApprovalSubject(project, action);
    const html = buildApprovalHtml(project, action);
    const text = buildApprovalText(project, action);

    await sendNotification({
      to: Array.from(to),
      cc: Array.from(cc),
      bcc: Array.from(bcc),
      subject,
      html,
      text,
      metadata: {
        projectId: project.projectId,
        projectName: project.projectName,
        action,
      },
    });
  } catch (error) {
    console.error("[Notification] Approval notification failed", {
      projectId: project?.projectId,
      projectName: project?.projectName,
      action,
      error,
    });
  }
}

function buildApprovalSubject(project, action) {
  const statusLabel = approvalActionLabel(action);
  return `[Approval] ${
    project.projectName
  } → ${statusLabel} [#${generateNotificationToken()}]`;
}

function buildApprovalHtml(project, action) {
  const statusLabel = approvalActionLabel(action);
  const intro = `The project <strong>${project.projectName}</strong> is now <strong>${statusLabel}</strong>.`;
  const sections = [
    {
      label: "Project",
      content: `
        <strong>${project.projectName}</strong><br/>
        ${project.clientName ? `Client: ${project.clientName}<br/>` : ""}
        ${
          project.contactPerson
            ? `Primary contact: ${project.contactPerson}<br/>`
            : ""
        }
        Updated by: ${
          project?.approvalNotes?.lastActorName ?? "Unknown"
        } at ${formatDateTime(project.updatedAt ?? new Date().toISOString())}
      `,
    },
  ];

  const reason =
    project.approvalReason || project.approvalNotes?.lastComment || "";
  if (reason.length) {
    sections.push({
      label: "Notes",
      content: reason,
    });
  }

  sections.push({
    label: "Next steps",
    content: `
      Status: ${project.approvalStatus || project.status}<br/>
      Readiness: ${project.readinessScore ?? 0}%<br/>
      Updated: ${formatDateTime(project.updatedAt ?? new Date().toISOString())}
    `,
  });

  const footer = `View the project: <a href="${buildProjectLink(
    project
  )}" style="color:#818cf8;">Open full editor</a>`;

  return buildNotificationTemplate({
    title: `${project.projectName} moved to ${statusLabel}`,
    intro,
    sections,
    footer,
  });
}

function buildApprovalText(project, action) {
  const statusLabel = approvalActionLabel(action);
  const parts = [
    `${project.projectName} is now ${statusLabel}.`,
    project.clientName ? `Client: ${project.clientName}` : "",
    project.contactPerson ? `Primary contact: ${project.contactPerson}` : "",
    `Updated by: ${
      project?.approvalNotes?.lastActorName ?? "Unknown"
    } at ${formatDateTime(project.updatedAt ?? new Date().toISOString())}`,
    project.approvalReason
      ? `Notes: ${project.approvalReason}`
      : project.approvalNotes?.lastComment
      ? `Notes: ${project.approvalNotes.lastComment}`
      : "",
    `Readiness: ${project.readinessScore ?? 0}%`,
    `Project link: ${buildProjectLink(project)}`,
  ];

  return parts.filter(Boolean).join("\n");
}

function approvalActionLabel(action) {
  switch (action) {
    case "approve":
      return "Approved";
    case "reject":
      return "Rejected";
    case "reset":
      return "Reset to Draft";
    case "request":
    default:
      return "In Review";
  }
}

async function notifyReviewerComment(project, commentPayload) {
  try {
    if (!project) {
      return;
    }

    const projectSpecificRecipients = await getProjectStakeholderEmails(
      project.projectId
    );

    const to = new Set(projectSpecificRecipients.to);
    const cc = new Set(projectSpecificRecipients.cc);
    const bcc = new Set(projectSpecificRecipients.bcc);

    const defaults =
      process.env.NOTIFY_APPROVAL_TO?.split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) ?? [];
    defaults.forEach((email) => to.add(email));

    if (!to.size && !cc.size && !bcc.size) {
            return;
    }

    const subject = buildReviewerCommentSubject(project, commentPayload);
    const html = buildReviewerCommentHtml(project, commentPayload);
    const text = buildReviewerCommentText(project, commentPayload);

    await sendNotification({
      to: Array.from(to),
      cc: Array.from(cc),
      bcc: Array.from(bcc),
      subject,
      html,
      text,
      metadata: {
        projectId: project.projectId,
        projectName: project.projectName,
        action: "reviewer_comment",
      },
    });
  } catch (error) {
    console.error("[Notification] Reviewer comment notification failed", {
      projectId: project?.projectId,
      projectName: project?.projectName,
      error,
    });
  }
}

function buildReviewerCommentSubject(project, commentPayload) {
  const reviewerName = commentPayload?.reviewerName || "A reviewer";
  return `[Review] ${
    project.projectName
  } - New comment from ${reviewerName} [#${generateNotificationToken()}]`;
}

function buildReviewerCommentHtml(project, commentPayload) {
  const reviewerName = commentPayload?.reviewerName || "A reviewer";
  const section = commentPayload?.section || "overview";
  const comment = commentPayload?.comment || "";
  const severity = commentPayload?.severity || "info";

  const intro = `<strong>${reviewerName}</strong> added a review comment on <strong>${project.projectName}</strong>.`;

  const sections = [
    {
      label: "Project",
      content: `
        <strong>${project.projectName}</strong><br/>
        ${project.clientName ? `Client: ${project.clientName}<br/>` : ""}
        Section: <strong>${section}</strong><br/>
        Severity: <strong>${severity}</strong>
      `,
    },
    {
      label: "Comment",
      content: comment || "No comment provided.",
    },
  ];

  const footer = `View the project: <a href="${buildProjectLink(
    project
  )}" style="color:#818cf8;">Open full editor</a>`;

  return buildNotificationTemplate({
    title: `New review comment on ${project.projectName}`,
    intro,
    sections,
    footer,
  });
}

function buildReviewerCommentText(project, commentPayload) {
  const reviewerName = commentPayload?.reviewerName || "A reviewer";
  const section = commentPayload?.section || "overview";
  const comment = commentPayload?.comment || "";
  const severity = commentPayload?.severity || "info";

  const parts = [
    `${reviewerName} added a review comment on ${project.projectName}.`,
    project.clientName ? `Client: ${project.clientName}` : "",
    `Section: ${section}`,
    `Severity: ${severity}`,
    `Comment: ${comment || "No comment provided."}`,
    `Project link: ${buildProjectLink(project)}`,
  ];

  return parts.filter(Boolean).join("\n");
}

async function notifyAssignmentCreated(assignment) {
  try {
    if (!assignment || !assignment.employeeEmail) {
            return;
    }

    const to = [assignment.employeeEmail];

    // Also notify project lead and sponsor
    if (assignment.projectId) {
      const project = await getProjectById(assignment.projectId);
      if (project) {
        const projectRecipients = await getProjectStakeholderEmails(
          assignment.projectId
        );
        // Add project lead and sponsor to CC
        const cc = new Set(projectRecipients.cc);
        projectRecipients.to.forEach((email) => {
          if (email !== assignment.employeeEmail) {
            cc.add(email);
          }
        });

        const defaults =
          process.env.NOTIFY_APPROVAL_TO?.split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0) ?? [];
        defaults.forEach((email) => {
          if (email !== assignment.employeeEmail) {
            cc.add(email);
          }
        });

        const subject = buildAssignmentSubject(assignment, project);
        const html = buildAssignmentHtml(assignment, project);
        const text = buildAssignmentText(assignment, project);

        await sendNotification({
          to,
          cc: Array.from(cc),
          bcc: [],
          subject,
          html,
          text,
          metadata: {
            assignmentId: assignment.empProjectId,
            projectId: assignment.projectId,
            employeeId: assignment.empId,
            action: "assignment_created",
          },
        });
        return;
      }
    }

    // Fallback if project not found
    const subject = buildAssignmentSubject(assignment, null);
    const html = buildAssignmentHtml(assignment, null);
    const text = buildAssignmentText(assignment, null);

    await sendNotification({
      to,
      cc: [],
      bcc: [],
      subject,
      html,
      text,
      metadata: {
        assignmentId: assignment.empProjectId,
        projectId: assignment.projectId,
        employeeId: assignment.empId,
        action: "assignment_created",
      },
    });
  } catch (error) {
    console.error("[Notification] Assignment notification failed", {
      assignmentId: assignment?.empProjectId,
      projectId: assignment?.projectId,
      error,
    });
  }
}

function buildAssignmentSubject(assignment, project) {
  const projectName =
    project?.projectName || assignment.projectName || "Project";
  return `[Assignment] You've been assigned to ${projectName} [#${generateNotificationToken()}]`;
}

function buildAssignmentHtml(assignment, project) {
  const projectName =
    project?.projectName || assignment.projectName || "Project";
  const employeeName = assignment.employeeName || "Team Member";
  const role = assignment.role || "Team Member";
  const allocationPct = assignment.allocationPct ?? "Not specified";
  const assignedDate = assignment.assignedDate
    ? formatDateTime(assignment.assignedDate)
    : "Not specified";
  const status =
    assignment.isActive === "Y" || assignment.isActive === true
      ? "Active"
      : "Inactive";
  const clientName = project?.clientName || "";
  const projectLink = project
    ? buildProjectLink(project)
    : `${process.env.APP_BASE_URL || "http://localhost:4200"}/projects`;

  const intro = `You've been assigned to work on <strong>${projectName}</strong>.`;

  const sections = [
    {
      label: "Assignment Details",
      content: `
        <strong>Project:</strong> ${projectName}<br/>
        ${clientName ? `<strong>Client:</strong> ${clientName}<br/>` : ""}
        <strong>Your Role:</strong> ${role}<br/>
        <strong>Allocation:</strong> ${allocationPct}%<br/>
        <strong>Assigned Date:</strong> ${assignedDate}<br/>
        <strong>Status:</strong> ${status}
      `,
    },
  ];

  if (assignment.notes) {
    sections.push({
      label: "Notes",
      content: assignment.notes,
    });
  }

  sections.push({
    label: "Next Steps",
    content: `
      Review the project details and connect with the project lead to get started.<br/>
      Project link: <a href="${projectLink}" style="color:#818cf8;">View Project</a>
    `,
  });

  const footer = `You received this notification because you've been assigned to this project.`;

  return buildNotificationTemplate({
    title: `New Assignment: ${projectName}`,
    intro,
    sections,
    footer,
  });
}

function buildAssignmentText(assignment, project) {
  const projectName =
    project?.projectName || assignment.projectName || "Project";
  const employeeName = assignment.employeeName || "Team Member";
  const role = assignment.role || "Team Member";
  const allocationPct = assignment.allocationPct ?? "Not specified";
  const assignedDate = assignment.assignedDate
    ? formatDateTime(assignment.assignedDate)
    : "Not specified";
  const status =
    assignment.isActive === "Y" || assignment.isActive === true
      ? "Active"
      : "Inactive";
  const clientName = project?.clientName || "";
  const projectLink = project
    ? buildProjectLink(project)
    : `${process.env.APP_BASE_URL || "http://localhost:4200"}/projects`;

  const parts = [
    `You've been assigned to work on ${projectName}.`,
    clientName ? `Client: ${clientName}` : "",
    `Your Role: ${role}`,
    `Allocation: ${allocationPct}%`,
    `Assigned Date: ${assignedDate}`,
    `Status: ${status}`,
    assignment.notes ? `Notes: ${assignment.notes}` : "",
    `Project link: ${projectLink}`,
  ];

  return parts.filter(Boolean).join("\n");
}

async function notifyAssignmentUpdated(assignment) {
  try {
    if (!assignment || !assignment.employeeEmail) {
            return;
    }

    const to = [assignment.employeeEmail];

    // Also notify project lead and sponsor
    if (assignment.projectId) {
      const project = await getProjectById(assignment.projectId);
      if (project) {
        const projectRecipients = await getProjectStakeholderEmails(
          assignment.projectId
        );
        // Add project lead and sponsor to CC
        const cc = new Set(projectRecipients.cc);
        projectRecipients.to.forEach((email) => {
          if (email !== assignment.employeeEmail) {
            cc.add(email);
          }
        });

        const defaults =
          process.env.NOTIFY_APPROVAL_TO?.split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0) ?? [];
        defaults.forEach((email) => {
          if (email !== assignment.employeeEmail) {
            cc.add(email);
          }
        });

        const subject = buildAssignmentUpdateSubject(assignment, project);
        const html = buildAssignmentUpdateHtml(assignment, project);
        const text = buildAssignmentUpdateText(assignment, project);

        await sendNotification({
          to,
          cc: Array.from(cc),
          bcc: [],
          subject,
          html,
          text,
          metadata: {
            assignmentId: assignment.empProjectId,
            projectId: assignment.projectId,
            employeeId: assignment.empId,
            action: "assignment_updated",
          },
        });
        return;
      }
    }

    // Fallback if project not found
    const subject = buildAssignmentUpdateSubject(assignment, null);
    const html = buildAssignmentUpdateHtml(assignment, null);
    const text = buildAssignmentUpdateText(assignment, null);

    await sendNotification({
      to,
      cc: [],
      bcc: [],
      subject,
      html,
      text,
      metadata: {
        assignmentId: assignment.empProjectId,
        projectId: assignment.projectId,
        employeeId: assignment.empId,
        action: "assignment_updated",
      },
    });
  } catch (error) {
    console.error("[Notification] Assignment update notification failed", {
      assignmentId: assignment?.empProjectId,
      projectId: assignment?.projectId,
      error,
    });
  }
}

function buildAssignmentUpdateSubject(assignment, project) {
  const projectName =
    project?.projectName || assignment.projectName || "Project";
  return `[Assignment Update] Changes to your ${projectName} assignment [#${generateNotificationToken()}]`;
}

function buildAssignmentUpdateHtml(assignment, project) {
  const projectName =
    project?.projectName || assignment.projectName || "Project";
  const employeeName = assignment.employeeName || "Team Member";
  const role = assignment.role || "Team Member";
  const allocationPct = assignment.allocationPct ?? "Not specified";
  const assignedDate = assignment.assignedDate
    ? formatDateTime(assignment.assignedDate)
    : "Not specified";
  const status =
    assignment.isActive === "Y" || assignment.isActive === true
      ? "Active"
      : "Inactive";
  const clientName = project?.clientName || "";
  const projectLink = project
    ? buildProjectLink(project)
    : `${process.env.APP_BASE_URL || "http://localhost:4200"}/projects`;

  const intro = `Your assignment to <strong>${projectName}</strong> has been updated.`;

  const sections = [
    {
      label: "Updated Assignment Details",
      content: `
        <strong>Project:</strong> ${projectName}<br/>
        ${clientName ? `<strong>Client:</strong> ${clientName}<br/>` : ""}
        <strong>Your Role:</strong> ${role}<br/>
        <strong>Allocation:</strong> ${allocationPct}%<br/>
        <strong>Assigned Date:</strong> ${assignedDate}<br/>
        <strong>Status:</strong> ${status}
      `,
    },
  ];

  if (assignment.notes) {
    sections.push({
      label: "Notes",
      content: assignment.notes,
    });
  }

  sections.push({
    label: "Next Steps",
    content: `
      Review the updated assignment details.<br/>
      Project link: <a href="${projectLink}" style="color:#818cf8;">View Project</a>
    `,
  });

  const footer = `You received this notification because your assignment details were updated.`;

  return buildNotificationTemplate({
    title: `Assignment Updated: ${projectName}`,
    intro,
    sections,
    footer,
  });
}

function buildAssignmentUpdateText(assignment, project) {
  const projectName =
    project?.projectName || assignment.projectName || "Project";
  const employeeName = assignment.employeeName || "Team Member";
  const role = assignment.role || "Team Member";
  const allocationPct = assignment.allocationPct ?? "Not specified";
  const assignedDate = assignment.assignedDate
    ? formatDateTime(assignment.assignedDate)
    : "Not specified";
  const status =
    assignment.isActive === "Y" || assignment.isActive === true
      ? "Active"
      : "Inactive";
  const clientName = project?.clientName || "";
  const projectLink = project
    ? buildProjectLink(project)
    : `${process.env.APP_BASE_URL || "http://localhost:4200"}/projects`;

  const parts = [
    `Your assignment to ${projectName} has been updated.`,
    clientName ? `Client: ${clientName}` : "",
    `Your Role: ${role}`,
    `Allocation: ${allocationPct}%`,
    `Assigned Date: ${assignedDate}`,
    `Status: ${status}`,
    assignment.notes ? `Notes: ${assignment.notes}` : "",
    `Project link: ${projectLink}`,
  ];

  return parts.filter(Boolean).join("\n");
}

async function notifyAssignmentDeleted(assignment) {
  try {
    if (!assignment || !assignment.employeeEmail) {
            return;
    }

    const to = [assignment.employeeEmail];

    // Also notify project lead and sponsor
    if (assignment.projectId) {
      const project = await getProjectById(assignment.projectId);
      if (project) {
        const projectRecipients = await getProjectStakeholderEmails(
          assignment.projectId
        );
        // Add project lead and sponsor to CC
        const cc = new Set(projectRecipients.cc);
        projectRecipients.to.forEach((email) => {
          if (email !== assignment.employeeEmail) {
            cc.add(email);
          }
        });

        const defaults =
          process.env.NOTIFY_APPROVAL_TO?.split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0) ?? [];
        defaults.forEach((email) => {
          if (email !== assignment.employeeEmail) {
            cc.add(email);
          }
        });

        const subject = buildAssignmentDeletedSubject(assignment, project);
        const html = buildAssignmentDeletedHtml(assignment, project);
        const text = buildAssignmentDeletedText(assignment, project);

        await sendNotification({
          to,
          cc: Array.from(cc),
          bcc: [],
          subject,
          html,
          text,
          metadata: {
            assignmentId: assignment.empProjectId,
            projectId: assignment.projectId,
            employeeId: assignment.empId,
            action: "assignment_deleted",
          },
        });
        return;
      }
    }

    // Fallback if project not found
    const subject = buildAssignmentDeletedSubject(assignment, null);
    const html = buildAssignmentDeletedHtml(assignment, null);
    const text = buildAssignmentDeletedText(assignment, null);

    await sendNotification({
      to,
      cc: [],
      bcc: [],
      subject,
      html,
      text,
      metadata: {
        assignmentId: assignment.empProjectId,
        projectId: assignment.projectId,
        employeeId: assignment.empId,
        action: "assignment_deleted",
      },
    });
  } catch (error) {
    console.error("[Notification] Assignment deletion notification failed", {
      assignmentId: assignment?.empProjectId,
      projectId: assignment?.projectId,
      error,
    });
  }
}

function buildAssignmentDeletedSubject(assignment, project) {
  const projectName =
    project?.projectName || assignment.projectName || "Project";
  return `[Assignment Removed] You've been unassigned from ${projectName} [#${generateNotificationToken()}]`;
}

function buildAssignmentDeletedHtml(assignment, project) {
  const projectName =
    project?.projectName || assignment.projectName || "Project";
  const employeeName = assignment.employeeName || "Team Member";
  const role = assignment.role || "Team Member";
  const allocationPct = assignment.allocationPct ?? "Not specified";
  const assignedDate = assignment.assignedDate
    ? formatDateTime(assignment.assignedDate)
    : "Not specified";
  const clientName = project?.clientName || "";
  const projectLink = project
    ? buildProjectLink(project)
    : `${process.env.APP_BASE_URL || "http://localhost:4200"}/projects`;

  const intro = `Your assignment to <strong>${projectName}</strong> has been removed.`;

  const sections = [
    {
      label: "Removed Assignment Details",
      content: `
        <strong>Project:</strong> ${projectName}<br/>
        ${clientName ? `<strong>Client:</strong> ${clientName}<br/>` : ""}
        <strong>Your Role:</strong> ${role}<br/>
        <strong>Allocation:</strong> ${allocationPct}%<br/>
        <strong>Assigned Date:</strong> ${assignedDate}
      `,
    },
  ];

  if (assignment.notes) {
    sections.push({
      label: "Previous Notes",
      content: assignment.notes,
    });
  }

  sections.push({
    label: "Next Steps",
    content: `
      If you have any questions about this change, please contact the project lead.<br/>
      Project link: <a href="${projectLink}" style="color:#818cf8;">View Project</a>
    `,
  });

  const footer = `You received this notification because your assignment to this project was removed.`;

  return buildNotificationTemplate({
    title: `Assignment Removed: ${projectName}`,
    intro,
    sections,
    footer,
  });
}

function buildAssignmentDeletedText(assignment, project) {
  const projectName =
    project?.projectName || assignment.projectName || "Project";
  const employeeName = assignment.employeeName || "Team Member";
  const role = assignment.role || "Team Member";
  const allocationPct = assignment.allocationPct ?? "Not specified";
  const assignedDate = assignment.assignedDate
    ? formatDateTime(assignment.assignedDate)
    : "Not specified";
  const clientName = project?.clientName || "";
  const projectLink = project
    ? buildProjectLink(project)
    : `${process.env.APP_BASE_URL || "http://localhost:4200"}/projects`;

  const parts = [
    `Your assignment to ${projectName} has been removed.`,
    clientName ? `Client: ${clientName}` : "",
    `Your Role: ${role}`,
    `Allocation: ${allocationPct}%`,
    `Assigned Date: ${assignedDate}`,
    assignment.notes ? `Previous Notes: ${assignment.notes}` : "",
    `Project link: ${projectLink}`,
  ];

  return parts.filter(Boolean).join("\n");
}

async function notifyProjectCreated(project) {
  try {
    if (!project || !project.projectId) {
            return;
    }

    const projectRecipients = await getProjectStakeholderEmails(
      project.projectId
    );
    const to = new Set(projectRecipients.to);
    const cc = new Set(projectRecipients.cc);
    const bcc = new Set(projectRecipients.bcc);

    // Add default notification recipients
    const defaults =
      process.env.NOTIFY_APPROVAL_TO?.split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) ?? [];
    defaults.forEach((email) => to.add(email));

    if (!to.size && !cc.size && !bcc.size) {
            return;
    }

    const subject = buildProjectCreatedSubject(project);
    const html = buildProjectCreatedHtml(project);
    const text = buildProjectCreatedText(project);

    await sendNotification({
      to: Array.from(to),
      cc: Array.from(cc),
      bcc: Array.from(bcc),
      subject,
      html,
      text,
      metadata: {
        projectId: project.projectId,
        projectName: project.projectName,
        action: "project_created",
      },
    });
  } catch (error) {
    console.error("[Notification] Project creation notification failed", {
      projectId: project?.projectId,
      projectName: project?.projectName,
      error,
    });
  }
}

async function notifyProjectUpdated(project) {
  try {
    if (!project || !project.projectId) {
            return;
    }

    const projectRecipients = await getProjectStakeholderEmails(
      project.projectId
    );
    const to = new Set(projectRecipients.to);
    const cc = new Set(projectRecipients.cc);
    const bcc = new Set(projectRecipients.bcc);

    // Add default notification recipients
    const defaults =
      process.env.NOTIFY_APPROVAL_TO?.split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) ?? [];
    defaults.forEach((email) => to.add(email));

    if (!to.size && !cc.size && !bcc.size) {
            return;
    }

    const subject = buildProjectUpdatedSubject(project);
    const html = buildProjectUpdatedHtml(project);
    const text = buildProjectUpdatedText(project);

    await sendNotification({
      to: Array.from(to),
      cc: Array.from(cc),
      bcc: Array.from(bcc),
      subject,
      html,
      text,
      metadata: {
        projectId: project.projectId,
        projectName: project.projectName,
        action: "project_updated",
      },
    });
  } catch (error) {
    console.error("[Notification] Project update notification failed", {
      projectId: project?.projectId,
      projectName: project?.projectName,
      error,
    });
  }
}

async function notifyProjectDeleted(project, preFetchedRecipients = null) {
  try {
    if (!project || !project.projectId) {
            return;
    }

    const to = new Set();
    const cc = new Set();
    const bcc = new Set();

    // Use pre-fetched recipients if available (fetched before deletion)
    if (preFetchedRecipients) {
      preFetchedRecipients.to.forEach((email) => to.add(email));
      preFetchedRecipients.cc.forEach((email) => cc.add(email));
      preFetchedRecipients.bcc.forEach((email) => bcc.add(email));
    }

    // Add project contact email
    if (project.emailId) {
      to.add(project.emailId);
    }

    // Try to get stakeholders from resourcesPlan if available
    if (project.resourcesPlan?.stakeholders) {
      project.resourcesPlan.stakeholders.forEach((stakeholder) => {
        if (stakeholder.email) {
          to.add(stakeholder.email);
        }
      });
    }

    // Add default notification recipients
    const defaults =
      process.env.NOTIFY_APPROVAL_TO?.split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) ?? [];
    defaults.forEach((email) => to.add(email));

    if (!to.size && !cc.size && !bcc.size) {
            return;
    }

    const subject = buildProjectDeletedSubject(project);
    const html = buildProjectDeletedHtml(project);
    const text = buildProjectDeletedText(project);

    await sendNotification({
      to: Array.from(to),
      cc: Array.from(cc),
      bcc: Array.from(bcc),
      subject,
      html,
      text,
      metadata: {
        projectId: project.projectId,
        projectName: project.projectName,
        action: "project_deleted",
      },
    });
  } catch (error) {
    console.error("[Notification] Project deletion notification failed", {
      projectId: project?.projectId,
      projectName: project?.projectName,
      error,
    });
  }
}

function buildProjectCreatedSubject(project) {
  return `[Project Created] ${
    project.projectName
  } [#${generateNotificationToken()}]`;
}

function buildProjectCreatedHtml(project) {
  const projectName = project.projectName || "New Project";
  const clientName = project.clientName || "";
  const status = project.status || "draft";
  const approvalStatus = project.approvalStatus || "draft";
  const startDate = project.startDate
    ? formatDateTime(project.startDate)
    : "Not specified";
  const projectLink = buildProjectLink(project);
  const overview = project.overview?.summary || "";

  const intro = `A new project <strong>${projectName}</strong> has been created.`;

  const sections = [
    {
      label: "Project Details",
      content: `
        <strong>Project Name:</strong> ${projectName}<br/>
        ${clientName ? `<strong>Client:</strong> ${clientName}<br/>` : ""}
        <strong>Status:</strong> ${status}<br/>
        <strong>Approval Status:</strong> ${approvalStatus}<br/>
        <strong>Start Date:</strong> ${startDate}
      `,
    },
  ];

  if (overview) {
    sections.push({
      label: "Overview",
      content: overview,
    });
  }

  sections.push({
    label: "Next Steps",
    content: `
      Review the project details and assign team members.<br/>
      Project link: <a href="${projectLink}" style="color:#818cf8;">View Project</a>
    `,
  });

  const footer = `You received this notification because you're listed as a stakeholder for this project.`;

  return buildNotificationTemplate({
    title: `New Project: ${projectName}`,
    intro,
    sections,
    footer,
  });
}

function buildProjectCreatedText(project) {
  const projectName = project.projectName || "New Project";
  const clientName = project.clientName || "";
  const status = project.status || "draft";
  const approvalStatus = project.approvalStatus || "draft";
  const startDate = project.startDate
    ? formatDateTime(project.startDate)
    : "Not specified";
  const projectLink = buildProjectLink(project);
  const overview = project.overview?.summary || "";

  const parts = [
    `A new project ${projectName} has been created.`,
    clientName ? `Client: ${clientName}` : "",
    `Status: ${status}`,
    `Approval Status: ${approvalStatus}`,
    `Start Date: ${startDate}`,
    overview ? `Overview: ${overview}` : "",
    `Project link: ${projectLink}`,
  ];

  return parts.filter(Boolean).join("\n");
}

function buildProjectUpdatedSubject(project) {
  return `[Project Updated] ${
    project.projectName
  } [#${generateNotificationToken()}]`;
}

function buildProjectUpdatedHtml(project) {
  const projectName = project.projectName || "Project";
  const clientName = project.clientName || "";
  const status = project.status || "draft";
  const approvalStatus = project.approvalStatus || "draft";
  const startDate = project.startDate
    ? formatDateTime(project.startDate)
    : "Not specified";
  const projectLink = buildProjectLink(project);
  const overview = project.overview?.summary || "";

  const intro = `The project <strong>${projectName}</strong> has been updated.`;

  const sections = [
    {
      label: "Updated Project Details",
      content: `
        <strong>Project Name:</strong> ${projectName}<br/>
        ${clientName ? `<strong>Client:</strong> ${clientName}<br/>` : ""}
        <strong>Status:</strong> ${status}<br/>
        <strong>Approval Status:</strong> ${approvalStatus}<br/>
        <strong>Start Date:</strong> ${startDate}
      `,
    },
  ];

  if (overview) {
    sections.push({
      label: "Overview",
      content: overview,
    });
  }

  sections.push({
    label: "Next Steps",
    content: `
      Review the updated project details.<br/>
      Project link: <a href="${projectLink}" style="color:#818cf8;">View Project</a>
    `,
  });

  const footer = `You received this notification because you're listed as a stakeholder for this project.`;

  return buildNotificationTemplate({
    title: `Project Updated: ${projectName}`,
    intro,
    sections,
    footer,
  });
}

function buildProjectUpdatedText(project) {
  const projectName = project.projectName || "Project";
  const clientName = project.clientName || "";
  const status = project.status || "draft";
  const approvalStatus = project.approvalStatus || "draft";
  const startDate = project.startDate
    ? formatDateTime(project.startDate)
    : "Not specified";
  const projectLink = buildProjectLink(project);
  const overview = project.overview?.summary || "";

  const parts = [
    `The project ${projectName} has been updated.`,
    clientName ? `Client: ${clientName}` : "",
    `Status: ${status}`,
    `Approval Status: ${approvalStatus}`,
    `Start Date: ${startDate}`,
    overview ? `Overview: ${overview}` : "",
    `Project link: ${projectLink}`,
  ];

  return parts.filter(Boolean).join("\n");
}

function buildProjectDeletedSubject(project) {
  return `[Project Deleted] ${
    project.projectName
  } [#${generateNotificationToken()}]`;
}

function buildProjectDeletedHtml(project) {
  const projectName = project.projectName || "Project";
  const clientName = project.clientName || "";
  const status = project.status || "draft";
  const startDate = project.startDate
    ? formatDateTime(project.startDate)
    : "Not specified";
  const overview = project.overview?.summary || "";

  const intro = `The project <strong>${projectName}</strong> has been deleted.`;

  const sections = [
    {
      label: "Deleted Project Details",
      content: `
        <strong>Project Name:</strong> ${projectName}<br/>
        ${clientName ? `<strong>Client:</strong> ${clientName}<br/>` : ""}
        <strong>Status:</strong> ${status}<br/>
        <strong>Start Date:</strong> ${startDate}
      `,
    },
  ];

  if (overview) {
    sections.push({
      label: "Overview",
      content: overview,
    });
  }

  sections.push({
    label: "Note",
    content: `
      All project assignments and related data have been removed. If you have any questions about this change, please contact your project manager.
    `,
  });

  const footer = `You received this notification because you were listed as a stakeholder for this project.`;

  return buildNotificationTemplate({
    title: `Project Deleted: ${projectName}`,
    intro,
    sections,
    footer,
  });
}

function buildProjectDeletedText(project) {
  const projectName = project.projectName || "Project";
  const clientName = project.clientName || "";
  const status = project.status || "draft";
  const startDate = project.startDate
    ? formatDateTime(project.startDate)
    : "Not specified";
  const overview = project.overview?.summary || "";

  const parts = [
    `The project ${projectName} has been deleted.`,
    clientName ? `Client: ${clientName}` : "",
    `Status: ${status}`,
    `Start Date: ${startDate}`,
    overview ? `Overview: ${overview}` : "",
    `Note: All project assignments and related data have been removed. If you have any questions about this change, please contact your project manager.`,
  ];

  return parts.filter(Boolean).join("\n");
}

async function getManagerEmail(managerId) {
  if (!managerId) {
    return null;
  }
  try {
    const manager = await prisma.employee.findUnique({
      where: { employeeId: Number(managerId) },
      select: { emailId: true, employeeName: true },
    });
    return manager?.emailId || null;
  } catch (error) {
        return null;
  }
}

async function notifyEmployeeCreated(employee) {
  try {
    if (!employee || !employee.emailId) {
            return;
    }

    const to = [employee.emailId];
    const cc = new Set();
    const bcc = new Set();

    // Add manager to CC if exists
    if (employee.managerId) {
      const managerEmail = await getManagerEmail(employee.managerId);
      if (managerEmail && managerEmail !== employee.emailId) {
        cc.add(managerEmail);
      }
    }

    // Add default notification recipients
    const defaults =
      process.env.NOTIFY_APPROVAL_TO?.split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) ?? [];
    defaults.forEach((email) => {
      if (email !== employee.emailId) {
        cc.add(email);
      }
    });

    if (!to.length && !cc.size && !bcc.size) {
            return;
    }

    const subject = buildEmployeeCreatedSubject(employee);
    const html = buildEmployeeCreatedHtml(employee);
    const text = buildEmployeeCreatedText(employee);

    await sendNotification({
      to,
      cc: Array.from(cc),
      bcc: Array.from(bcc),
      subject,
      html,
      text,
      metadata: {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        action: "employee_created",
      },
    });
  } catch (error) {
    console.error("[Notification] Employee creation notification failed", {
      employeeId: employee?.employeeId,
      employeeName: employee?.employeeName,
      error,
    });
  }
}

async function notifyEmployeeUpdated(employee) {
  try {
    if (!employee || !employee.emailId) {
            return;
    }

    const to = [employee.emailId];
    const cc = new Set();
    const bcc = new Set();

    // Add manager to CC if exists
    if (employee.managerId) {
      const managerEmail = await getManagerEmail(employee.managerId);
      if (managerEmail && managerEmail !== employee.emailId) {
        cc.add(managerEmail);
      }
    }

    // Add default notification recipients
    const defaults =
      process.env.NOTIFY_APPROVAL_TO?.split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) ?? [];
    defaults.forEach((email) => {
      if (email !== employee.emailId) {
        cc.add(email);
      }
    });

    if (!to.length && !cc.size && !bcc.size) {
            return;
    }

    const subject = buildEmployeeUpdatedSubject(employee);
    const html = buildEmployeeUpdatedHtml(employee);
    const text = buildEmployeeUpdatedText(employee);

    await sendNotification({
      to,
      cc: Array.from(cc),
      bcc: Array.from(bcc),
      subject,
      html,
      text,
      metadata: {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        action: "employee_updated",
      },
    });
  } catch (error) {
    console.error("[Notification] Employee update notification failed", {
      employeeId: employee?.employeeId,
      employeeName: employee?.employeeName,
      error,
    });
  }
}

async function notifyEmployeeDeleted(employee) {
  try {
    if (!employee || !employee.emailId) {
            return;
    }

    const to = [employee.emailId];
    const cc = new Set();
    const bcc = new Set();

    // Add manager to CC if exists
    if (employee.managerId) {
      const managerEmail = await getManagerEmail(employee.managerId);
      if (managerEmail && managerEmail !== employee.emailId) {
        cc.add(managerEmail);
      }
    }

    // Add default notification recipients
    const defaults =
      process.env.NOTIFY_APPROVAL_TO?.split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) ?? [];
    defaults.forEach((email) => {
      if (email !== employee.emailId) {
        cc.add(email);
      }
    });

    if (!to.length && !cc.size && !bcc.size) {
            return;
    }

    const subject = buildEmployeeDeletedSubject(employee);
    const html = buildEmployeeDeletedHtml(employee);
    const text = buildEmployeeDeletedText(employee);

    await sendNotification({
      to,
      cc: Array.from(cc),
      bcc: Array.from(bcc),
      subject,
      html,
      text,
      metadata: {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        action: "employee_deleted",
      },
    });
  } catch (error) {
    console.error("[Notification] Employee deletion notification failed", {
      employeeId: employee?.employeeId,
      employeeName: employee?.employeeName,
      error,
    });
  }
}

function buildEmployeeCreatedSubject(employee) {
  const employeeName = employee.employeeName || "Team Member";
  return `[Welcome] Welcome to the team, ${employeeName}! [#${generateNotificationToken()}]`;
}

function buildEmployeeCreatedHtml(employee) {
  const employeeName = employee.employeeName || "Team Member";
  const department = employee.department || "";
  const title = employee.title || "";
  const role = employee.role || "";
  // Use hireDate if available, otherwise fall back to createdAt (employee creation date)
  const hireDate = employee.hireDate
    ? formatDateTime(employee.hireDate)
    : employee.createdAt
    ? formatDateTime(employee.createdAt)
    : formatDateTime(new Date().toISOString());
  const location = employee.location || "";
  const employeeLink = `${
    process.env.APP_BASE_URL || "http://localhost:4200"
  }/employees`;

  const intro = `Welcome to the team, <strong>${employeeName}</strong>! We're excited to have you on board.`;

  const sections = [
    {
      label: "Your Details",
      content: `
        <strong>Name:</strong> ${employeeName}<br/>
        ${title ? `<strong>Title:</strong> ${title}<br/>` : ""}
        ${role ? `<strong>Role:</strong> ${role}<br/>` : ""}
        ${department ? `<strong>Department:</strong> ${department}<br/>` : ""}
        ${location ? `<strong>Location:</strong> ${location}<br/>` : ""}
        <strong>Hire Date:</strong> ${hireDate}
      `,
    },
  ];

  sections.push({
    label: "Next Steps",
    content: `
      Complete your profile and explore the employee management system.<br/>
      Employee portal: <a href="${employeeLink}" style="color:#818cf8;">View Portal</a>
    `,
  });

  const footer = `We're thrilled to have you join our team. If you have any questions, don't hesitate to reach out!`;

  return buildNotificationTemplate({
    title: `Welcome, ${employeeName}!`,
    intro,
    sections,
    footer,
  });
}

function buildEmployeeCreatedText(employee) {
  const employeeName = employee.employeeName || "Team Member";
  const department = employee.department || "";
  const title = employee.title || "";
  const role = employee.role || "";
  // Use hireDate if available, otherwise fall back to createdAt (employee creation date)
  const hireDate = employee.hireDate
    ? formatDateTime(employee.hireDate)
    : employee.createdAt
    ? formatDateTime(employee.createdAt)
    : formatDateTime(new Date().toISOString());
  const location = employee.location || "";
  const employeeLink = `${
    process.env.APP_BASE_URL || "http://localhost:4200"
  }/employees`;

  const parts = [
    `Welcome to the team, ${employeeName}! We're excited to have you on board.`,
    title ? `Title: ${title}` : "",
    role ? `Role: ${role}` : "",
    department ? `Department: ${department}` : "",
    location ? `Location: ${location}` : "",
    `Hire Date: ${hireDate}`,
    `Employee portal: ${employeeLink}`,
  ];

  return parts.filter(Boolean).join("\n");
}

function buildEmployeeUpdatedSubject(employee) {
  const employeeName = employee.employeeName || "Team Member";
  return `[Profile Updated] Your employee profile has been updated [#${generateNotificationToken()}]`;
}

function buildEmployeeUpdatedHtml(employee) {
  const employeeName = employee.employeeName || "Team Member";
  const department = employee.department || "";
  const title = employee.title || "";
  const role = employee.role || "";
  const location = employee.location || "";
  const employeeLink = `${
    process.env.APP_BASE_URL || "http://localhost:4200"
  }/employees`;

  const intro = `Your employee profile has been updated, <strong>${employeeName}</strong>.`;

  const sections = [
    {
      label: "Updated Details",
      content: `
        <strong>Name:</strong> ${employeeName}<br/>
        ${title ? `<strong>Title:</strong> ${title}<br/>` : ""}
        ${role ? `<strong>Role:</strong> ${role}<br/>` : ""}
        ${department ? `<strong>Department:</strong> ${department}<br/>` : ""}
        ${location ? `<strong>Location:</strong> ${location}<br/>` : ""}
      `,
    },
  ];

  sections.push({
    label: "Next Steps",
    content: `
      Review your updated profile information.<br/>
      Employee portal: <a href="${employeeLink}" style="color:#818cf8;">View Profile</a>
    `,
  });

  const footer = `If you notice any discrepancies, please contact HR or your manager.`;

  return buildNotificationTemplate({
    title: `Profile Updated: ${employeeName}`,
    intro,
    sections,
    footer,
  });
}

function buildEmployeeUpdatedText(employee) {
  const employeeName = employee.employeeName || "Team Member";
  const department = employee.department || "";
  const title = employee.title || "";
  const role = employee.role || "";
  const location = employee.location || "";
  const employeeLink = `${
    process.env.APP_BASE_URL || "http://localhost:4200"
  }/employees`;

  const parts = [
    `Your employee profile has been updated, ${employeeName}.`,
    title ? `Title: ${title}` : "",
    role ? `Role: ${role}` : "",
    department ? `Department: ${department}` : "",
    location ? `Location: ${location}` : "",
    `Employee portal: ${employeeLink}`,
  ];

  return parts.filter(Boolean).join("\n");
}

function buildEmployeeDeletedSubject(employee) {
  const employeeName = employee.employeeName || "Team Member";
  return `[Account Removed] Your employee account has been removed [#${generateNotificationToken()}]`;
}

function buildEmployeeDeletedHtml(employee) {
  const employeeName = employee.employeeName || "Team Member";
  const department = employee.department || "";
  const title = employee.title || "";

  const intro = `Your employee account has been removed from the system, <strong>${employeeName}</strong>.`;

  const sections = [
    {
      label: "Account Details",
      content: `
        <strong>Name:</strong> ${employeeName}<br/>
        ${title ? `<strong>Title:</strong> ${title}<br/>` : ""}
        ${department ? `<strong>Department:</strong> ${department}<br/>` : ""}
      `,
    },
    {
      label: "Note",
      content: `
        All your project assignments and related data have been removed. If you have any questions about this change, please contact HR or your manager.
      `,
    },
  ];

  const footer = `You received this notification because your employee account was removed from the system.`;

  return buildNotificationTemplate({
    title: `Account Removed: ${employeeName}`,
    intro,
    sections,
    footer,
  });
}

function buildEmployeeDeletedText(employee) {
  const employeeName = employee.employeeName || "Team Member";
  const department = employee.department || "";
  const title = employee.title || "";

  const parts = [
    `Your employee account has been removed from the system, ${employeeName}.`,
    title ? `Title: ${title}` : "",
    department ? `Department: ${department}` : "",
    `Note: All your project assignments and related data have been removed. If you have any questions about this change, please contact HR or your manager.`,
  ];

  return parts.filter(Boolean).join("\n");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function buildProjectLink(project) {
  const base =
    process.env.APP_BASE_URL ||
    process.env.VITE_APP_BASE_URL ||
    process.env.NG_APP_BASE_URL ||
    "http://localhost:4200";
  const projectId = project?.projectId ?? project?.id;
  if (!projectId || Number(projectId) === 0) {
    return `${base}/new-project/0`;
  }
  return `${base}/update-project/${projectId}`;
}

function generateNotificationToken() {
  const now = new Date();
  const parts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
  ];
  const random = Math.random().toString(36).slice(-4).toUpperCase();
  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}-${random}`;
}

function normalizePathname(url) {
  let pathname = url.pathname || "";

  // Remove leading and trailing slashes
  pathname = pathname.replace(/^\/+|\/+$/g, "");

  // Handle empty pathname
  if (!pathname) {
    return "";
  }

  const parts = pathname.split("/").filter((p) => p.length > 0);

  // Debug: log the parts to understand the structure
      // On Vercel, request.url contains the full path: /api/employee-management/GetProject/5001
  // On localhost, it's the same: /api/employee-management/GetProject/5001
  // We need to extract: GetProject/5001

  // Find the index of "employee-management" to know where to start slicing
  const employeeManagementIndex = parts.findIndex(
    (p) => p === "employee-management"
  );

  if (employeeManagementIndex >= 0) {
    // We found "employee-management", skip up to and including it
    const remainingParts = parts.slice(employeeManagementIndex + 1);
    const result = remainingParts.join("/");
            return result;
  }

  // If "employee-management" is not found, check if it starts with "api"
  // Path structure: /api/employee-management/GetProject/5001
  // After split: ["api", "employee-management", "GetProject", "5001"]
  // We want: "GetProject/5001"
  if (
    parts.length >= 3 &&
    parts[0] === "api" &&
    parts[1] === "employee-management"
  ) {
    const result = parts.slice(2).join("/");
        return result;
  }

  // If it doesn't start with "api" or "employee-management", assume it's already normalized
  // This handles cases where the path is already just "GetProject/5001"
  if (
    parts.length > 0 &&
    parts[0] !== "api" &&
    parts[0] !== "employee-management"
  ) {
    const result = parts.join("/");
        return result;
  }

  // Fallback: if we have at least 2 parts, skip the first two
  if (parts.length > 2) {
    const result = parts.slice(2).join("/");
        return result;
  }

  // Last resort: return empty string
    return "";
}

function buildApiDocumentation(request) {
  // Use relative path for baseUrl - works in both localhost and production
  // The frontend uses relative paths, so this ensures consistency
  const baseUrl = "/api/employee-management";

  return {
    info: {
      title: "Employee Management API",
      version: "1.0.0",
      description:
        "RESTful API for managing employees, projects, and assignments",
      baseUrl: baseUrl,
    },
    endpoints: {
      GET: [
        {
          path: "GetParentDepartment",
          method: "GET",
          description: "Get all parent departments",
          url: `${baseUrl}/GetParentDepartment`,
          response: {
            status: 200,
            body: {
              result: "boolean",
              message: "string",
              data: "Array<Department>",
            },
          },
          category: "Departments",
        },
        {
          path: "GetChildDepartmentByParentId",
          method: "GET",
          description: "Get child departments by parent department ID",
          url: `${baseUrl}/GetChildDepartmentByParentId?deptId={id}`,
          parameters: [
            {
              name: "deptId",
              type: "number",
              required: true,
              description: "Parent department ID",
            },
          ],
          response: {
            status: 200,
            body: {
              result: "boolean",
              message: "string",
              data: "Array<Department>",
            },
          },
          category: "Departments",
        },
        {
          path: "GetAllEmployees",
          method: "GET",
          description: "Get all employees",
          url: `${baseUrl}/GetAllEmployees`,
          response: {
            status: 200,
            body: "Array<Employee>",
          },
          category: "Employees",
        },
        {
          path: "GetAllProjects",
          method: "GET",
          description: "Get all projects",
          url: `${baseUrl}/GetAllProjects`,
          response: {
            status: 200,
            body: "Array<Project>",
          },
          category: "Projects",
        },
        {
          path: "GetProject/{id}",
          method: "GET",
          description: "Get a specific project by ID",
          url: `${baseUrl}/GetProject/{id}`,
          parameters: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "Project ID",
            },
          ],
          response: {
            status: 200,
            body: "Project",
          },
          errorResponses: [
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
          ],
          category: "Projects",
        },
        {
          path: "GetContentfulBrief",
          method: "GET",
          description: "Fetch content from Contentful CMS",
          url: `${baseUrl}/GetContentfulBrief?entryId={id}&contentType={type}&slug={slug}&preview={boolean}`,
          parameters: [
            {
              name: "entryId",
              type: "string",
              required: false,
              description: "Contentful entry ID",
            },
            {
              name: "contentType",
              type: "string",
              required: false,
              description: "Content type",
            },
            {
              name: "slug",
              type: "string",
              required: false,
              description: "Content slug",
            },
            {
              name: "preview",
              type: "boolean",
              required: false,
              description: "Use preview API",
            },
          ],
          response: {
            status: 200,
            body: "ContentfulBrief",
          },
          errorResponses: [
            {
              status: 400,
              body: {
                result: false,
                message: "Provide entryId or contentType parameter.",
              },
            },
            {
              status: 500,
              body: { result: false, message: "Contentful error" },
            },
          ],
          category: "Content",
        },
        {
          path: "GetProjectResources/{id}",
          method: "GET",
          description: "Get resource insights for a project",
          url: `${baseUrl}/GetProjectResources/{id}`,
          parameters: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "Project ID",
            },
          ],
          response: {
            status: 200,
            body: "ProjectResourceInsights",
          },
          errorResponses: [
            {
              status: 400,
              body: { result: false, message: "Invalid project identifier" },
            },
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
          ],
          category: "Projects",
        },
        {
          path: "GetAllProjectEmployees",
          method: "GET",
          description: "Get all project-employee assignments",
          url: `${baseUrl}/GetAllProjectEmployees`,
          response: {
            status: 200,
            body: "Array<ProjectEmployee>",
          },
          category: "Assignments",
        },
        {
          path: "GetDashboard",
          method: "GET",
          description: "Get dashboard snapshot with statistics",
          url: `${baseUrl}/GetDashboard`,
          response: {
            status: 200,
            body: "DashboardSnapshot",
          },
          category: "Dashboard",
        },
        {
          path: "GetSchedule",
          method: "GET",
          description: "Get schedule data for calendar and timeline views",
          url: `${baseUrl}/GetSchedule`,
          response: {
            status: 200,
            body: "ScheduleData",
          },
          category: "Schedule",
        },
      ],
      POST: [
        {
          path: "GenerateOverviewDraft",
          method: "POST",
          description: "Generate AI-powered project overview draft",
          url: `${baseUrl}/GenerateOverviewDraft`,
          requestBody: {
            contentType: "application/json",
            schema: "GenerateOverviewDraftRequest",
          },
          response: {
            status: 200,
            body: "AiOverviewDraft",
          },
          errorResponses: [
            {
              status: 500,
              body: {
                result: false,
                message: "Unable to generate overview draft",
              },
            },
          ],
          category: "AI",
        },
        {
          path: "CreateEmployee",
          method: "POST",
          description: "Create a new employee",
          url: `${baseUrl}/CreateEmployee`,
          requestBody: {
            contentType: "application/json",
            schema: "Employee",
          },
          response: {
            status: 201,
            body: {
              result: true,
              message: "Employee created successfully",
              data: "Employee",
            },
          },
          category: "Employees",
        },
        {
          path: "CreateProject",
          method: "POST",
          description: "Create a new project",
          url: `${baseUrl}/CreateProject`,
          requestBody: {
            contentType: "application/json",
            schema: "Project",
          },
          response: {
            status: 201,
            body: "Project",
          },
          category: "Projects",
        },
        {
          path: "CreateProjectEmployee",
          method: "POST",
          description: "Assign an employee to a project",
          url: `${baseUrl}/CreateProjectEmployee`,
          requestBody: {
            contentType: "application/json",
            schema: "ProjectEmployee",
          },
          response: {
            status: 201,
            body: "ProjectEmployee",
          },
          category: "Assignments",
        },
        {
          path: "RequestApproval",
          method: "POST",
          description: "Request approval for a project",
          url: `${baseUrl}/RequestApproval`,
          requestBody: {
            contentType: "application/json",
            schema: { projectId: "number" },
          },
          response: {
            status: 200,
            body: "Project",
          },
          errorResponses: [
            {
              status: 400,
              body: {
                result: false,
                message: "Invalid projectId for approval request",
              },
            },
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
          ],
          category: "Approvals",
        },
        {
          path: "ApproveProject",
          method: "POST",
          description: "Approve a project",
          url: `${baseUrl}/ApproveProject`,
          requestBody: {
            contentType: "application/json",
            schema: { projectId: "number" },
          },
          response: {
            status: 200,
            body: "Project",
          },
          errorResponses: [
            {
              status: 400,
              body: {
                result: false,
                message: "Invalid projectId for approval",
              },
            },
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
          ],
          category: "Approvals",
        },
        {
          path: "RejectProject",
          method: "POST",
          description: "Reject a project",
          url: `${baseUrl}/RejectProject`,
          requestBody: {
            contentType: "application/json",
            schema: { projectId: "number" },
          },
          response: {
            status: 200,
            body: "Project",
          },
          errorResponses: [
            {
              status: 400,
              body: {
                result: false,
                message: "Invalid projectId for rejection",
              },
            },
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
          ],
          category: "Approvals",
        },
        {
          path: "ResetProjectApproval",
          method: "POST",
          description: "Reset project approval status",
          url: `${baseUrl}/ResetProjectApproval`,
          requestBody: {
            contentType: "application/json",
            schema: { projectId: "number" },
          },
          response: {
            status: 200,
            body: "Project",
          },
          errorResponses: [
            {
              status: 400,
              body: { result: false, message: "Invalid projectId for reset" },
            },
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
          ],
          category: "Approvals",
        },
        {
          path: "AddReviewerComment",
          method: "POST",
          description: "Add a reviewer comment to a project",
          url: `${baseUrl}/AddReviewerComment`,
          requestBody: {
            contentType: "application/json",
            schema: {
              projectId: "number",
              comment: "string",
              reviewerName: "string",
            },
          },
          response: {
            status: 200,
            body: "Project",
          },
          errorResponses: [
            {
              status: 400,
              body: {
                result: false,
                message: "Invalid projectId for reviewer comment",
              },
            },
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
          ],
          category: "Approvals",
        },
        {
          path: "ResolveReviewerComment",
          method: "POST",
          description: "Resolve a reviewer comment",
          url: `${baseUrl}/ResolveReviewerComment`,
          requestBody: {
            contentType: "application/json",
            schema: {
              projectId: "number",
              commentId: "string",
            },
          },
          response: {
            status: 200,
            body: "Project",
          },
          errorResponses: [
            {
              status: 400,
              body: {
                result: false,
                message: "Invalid project or comment identifier",
              },
            },
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
            {
              status: 404,
              body: { result: false, message: "Reviewer comment not found" },
            },
          ],
          category: "Approvals",
        },
      ],
      PUT: [
        {
          path: "UpdateEmployee/{id}",
          method: "PUT",
          description: "Update an existing employee",
          url: `${baseUrl}/UpdateEmployee/{id}`,
          parameters: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "Employee ID",
            },
          ],
          requestBody: {
            contentType: "application/json",
            schema: "Employee",
          },
          response: {
            status: 200,
            body: {
              result: true,
              message: "Employee updated successfully",
              data: "Employee",
            },
          },
          errorResponses: [
            {
              status: 404,
              body: { result: false, message: "Employee not found" },
            },
          ],
          category: "Employees",
        },
        {
          path: "UpdateProject/{id}",
          method: "PUT",
          description: "Update an existing project",
          url: `${baseUrl}/UpdateProject/{id}`,
          parameters: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "Project ID",
            },
          ],
          requestBody: {
            contentType: "application/json",
            schema: "Project",
          },
          response: {
            status: 200,
            body: "Project",
          },
          errorResponses: [
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
          ],
          category: "Projects",
        },
        {
          path: "UpdateProjectEmployee/{id}",
          method: "PUT",
          description: "Update a project-employee assignment",
          url: `${baseUrl}/UpdateProjectEmployee/{id}`,
          parameters: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "Project Employee ID",
            },
          ],
          requestBody: {
            contentType: "application/json",
            schema: "ProjectEmployee",
          },
          response: {
            status: 200,
            body: "ProjectEmployee",
          },
          errorResponses: [
            {
              status: 404,
              body: { result: false, message: "Project employee not found" },
            },
          ],
          category: "Assignments",
        },
      ],
      DELETE: [
        {
          path: "DeleteEmployee/{id}",
          method: "DELETE",
          description: "Delete an employee",
          url: `${baseUrl}/DeleteEmployee/{id}`,
          parameters: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "Employee ID",
            },
          ],
          response: {
            status: 200,
            body: {
              result: true,
              message: "Employee deleted successfully",
            },
          },
          errorResponses: [
            {
              status: 404,
              body: { result: false, message: "Employee not found" },
            },
          ],
          category: "Employees",
        },
        {
          path: "DeleteProject/{id}",
          method: "DELETE",
          description: "Delete a project",
          url: `${baseUrl}/DeleteProject/{id}`,
          parameters: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "Project ID",
            },
          ],
          response: {
            status: 200,
            body: {
              result: true,
              message: "Project deleted successfully",
            },
          },
          errorResponses: [
            {
              status: 404,
              body: { result: false, message: "Project not found" },
            },
          ],
          category: "Projects",
        },
        {
          path: "DeleteProjectEmployee/{id}",
          method: "DELETE",
          description: "Remove an employee from a project",
          url: `${baseUrl}/DeleteProjectEmployee/{id}`,
          parameters: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "Project Employee ID",
            },
          ],
          response: {
            status: 200,
            body: {
              result: true,
              message: "Project employee deleted successfully",
            },
          },
          errorResponses: [
            {
              status: 404,
              body: { result: false, message: "Project employee not found" },
            },
          ],
          category: "Assignments",
        },
      ],
    },
  };
}

export async function handleEmployeeManagementRequest(request, response) {
  // Handle Vercel serverless function format
  // On Vercel, request.url contains the full path including /api/employee-management/...
  let requestUrl = request.url || "";

  // Handle relative URLs (Vercel serverless functions)
  if (!requestUrl.startsWith("http")) {
    const host = request.headers?.host || request.headers?.Host || "localhost";
    const protocol =
      host.includes("localhost") || host.includes("127.0.0.1")
        ? "http"
        : "https";
    // Ensure the path starts with /
    if (!requestUrl.startsWith("/")) {
      requestUrl = "/" + requestUrl;
    }
    requestUrl = `${protocol}://${host}${requestUrl}`;
  }

  let url;
  try {
    url = new URL(requestUrl);
  } catch (error) {
    console.error("[Handler] Invalid URL:", requestUrl, error);
    return sendJson(
      response,
      400,
      createApiResponse(false, "Invalid request URL"),
      { value: 400 }
    );
  }

  const requestPath = normalizePathname(url);

  // Debug logging for troubleshooting (works in both dev and production on Vercel)
            const pathParts = requestPath.split("/").filter((p) => p.length > 0);
  const action = pathParts[0] || "";
  const rawId = pathParts[1] || "";
  const method = (request.method || "GET").toUpperCase();
  const requestStartTime = Date.now();
  const statusCodeRef = { value: 200 };
  let error = null;

  if (!isPublicAction(method, action)) {
    const session = await requireAuth(request, response);
    if (!session) {
      statusCodeRef.value = 401;
      if (action !== "GetApiStatus") {
        logRequest({
          endpoint: action || "unknown",
          method,
          status: 401,
          responseTime: Date.now() - requestStartTime,
          error: null,
        });
      }
      return 401;
    }
  }

  try {
    if (method === "GET" && (!action || action === "")) {
      return sendJson(
        response,
        200,
        {
          name: "Employee Management Mock API",
          version: "1.0.0",
        },
        statusCodeRef
      );
    }

    switch (method) {
      case "GET": {
        if (action === "GetDemoAccounts") {
          const accounts = await listDemoAccounts();
          return sendJson(
            response,
            200,
            createApiResponse(true, "Demo accounts", accounts),
            statusCodeRef
          );
        }

        if (action === "Session") {
          const session = await getSessionFromRequest(request);
          if (!session) {
            return sendJson(
              response,
              401,
              createApiResponse(false, "Not authenticated"),
              statusCodeRef
            );
          }
          return sendJson(
            response,
            200,
            createApiResponse(true, "Session active", session.user),
            statusCodeRef
          );
        }

        if (action === "GetParentDepartment") {
          const parents = await listParentDepartments();
          return sendJson(
            response,
            200,
            createApiResponse(true, "Parent department list", parents),
            statusCodeRef
          );
        }

        if (action === "GetChildDepartmentByParentId") {
          const deptId = Number(url.searchParams.get("deptId"));
          const children = Number.isNaN(deptId)
            ? []
            : await listChildDepartmentsByParent(deptId);
          return sendJson(
            response,
            200,
            createApiResponse(true, "Child department list", children),
            statusCodeRef
          );
        }

        if (action === "GetAllEmployees") {
          const employees = await listEmployees();
          return sendJson(response, 200, employees, statusCodeRef);
        }

        if (action === "GetAllProjects") {
          const projects = await listProjects();
          return sendJson(response, 200, projects, statusCodeRef);
        }

        if (action === "GetProject") {
          // Support both path parameter (GetProject/5001) and query parameter (GetProject?id=5001)
          const projectId = Number(rawId || url.searchParams.get("id"));
          if (!projectId || isNaN(projectId)) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid project ID"),
              statusCodeRef
            );
          }
          const project = await getProjectById(projectId);
          if (!project) {
            return sendJson(
              response,
              404,
              createApiResponse(false, "Project not found"),
              statusCodeRef
            );
          }
          return sendJson(response, 200, project, statusCodeRef);
        }

        if (action === "GetContentfulBrief") {
          try {
            const entryId = url.searchParams.get("entryId") || undefined;
            const contentType =
              url.searchParams.get("contentType") || undefined;
            const slug = url.searchParams.get("slug") || undefined;
            const preview = url.searchParams.get("preview") === "true";
            if (!entryId && !contentType) {
              return sendJson(
                response,
                400,
                createApiResponse(
                  false,
                  "Provide entryId or contentType parameter."
                ),
                statusCodeRef
              );
            }
            const brief = await fetchContentfulBrief({
              entryId,
              contentType,
              slug,
              preview,
            });
            return sendJson(response, 200, brief, statusCodeRef);
          } catch (error) {
            console.error("[Contentful] fetch failed", error);
            return sendJson(
              response,
              500,
              createApiResponse(false, error?.message || "Contentful error"),
              statusCodeRef
            );
          }
        }

        if (action === "GetProjectResources") {
          // Support both path parameter (GetProjectResources/5001) and query parameter (GetProjectResources?id=5001)
          const projectId = Number(rawId || url.searchParams.get("id"));
          if (!projectId || isNaN(projectId)) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid project identifier"),
              statusCodeRef
            );
          }
          const insights = await getProjectResourceInsights(projectId);
          if (!insights) {
            return sendJson(
              response,
              404,
              createApiResponse(false, "Project not found"),
              statusCodeRef
            );
          }
          return sendJson(response, 200, insights, statusCodeRef);
        }

        if (action === "GetAllProjectEmployees") {
          const projectEmployees = await listProjectEmployees();
          return sendJson(response, 200, projectEmployees, statusCodeRef);
        }

        if (action === "GetDashboard") {
          const dashboard = await buildDashboardSnapshot();
          return sendJson(response, 200, dashboard, statusCodeRef);
        }

        if (action === "GetSchedule") {
          const schedule = await buildScheduleData();
          return sendJson(response, 200, schedule, statusCodeRef);
        }

        if (action === "GetApiStatus") {
          const status = await buildApiStatus();
          return sendJson(response, 200, status, statusCodeRef);
        }

        if (action === "GetApiDocumentation") {
          const apiDoc = buildApiDocumentation(request);
          return sendJson(response, 200, apiDoc, statusCodeRef);
        }

        break;
      }

      case "POST": {
        const body = await readRequestBody(request);

        if (action === "Login") {
          if (isLoginRateLimited(request)) {
            return sendJson(
              response,
              429,
              createApiResponse(
                false,
                "Too many login attempts. Try again later."
              ),
              statusCodeRef
            );
          }

          const parsed = parseLoginCredentials(body ?? {});
          if (!parsed.success) {
            return sendJson(
              response,
              400,
              createApiResponse(false, parsed.message),
              statusCodeRef
            );
          }

          const { username, password } = parsed.data;
          const user = await authenticateUser(username, password);
          if (!user) {
            recordFailedLogin(request);
            return sendJson(
              response,
              401,
              createApiResponse(false, "Invalid username or password"),
              statusCodeRef
            );
          }

          clearLoginAttempts(request);
          const token = await createSession(user.id);
          setSessionCookie(response, token);
          return sendJson(
            response,
            200,
            createApiResponse(true, "Login successful", user),
            statusCodeRef
          );
        }

        if (action === "Logout") {
          const cookies = parseCookies(request.headers?.cookie);
          const token = cookies[SESSION_COOKIE_NAME];
          if (token) {
            await deleteSessionByToken(token);
          }
          clearSessionCookie(response);
          return sendJson(
            response,
            200,
            createApiResponse(true, "Logged out"),
            statusCodeRef
          );
        }

        if (action === "GenerateOverviewDraft") {
          try {
            const draft = await generateOverviewDraft(body ?? {});
            return sendJson(response, 200, draft, statusCodeRef);
          } catch (error) {
            console.error("[AI] generate overview failed", error);
            return sendJson(
              response,
              500,
              createApiResponse(
                false,
                error?.message || "Unable to generate overview draft"
              ),
              statusCodeRef
            );
          }
        }

        if (action === "CreateEmployee") {
          const employee = await createEmployee(body ?? {});
          // Send welcome email notification to the new employee
          await notifyEmployeeCreated(employee);
          return sendJson(
            response,
            201,
            createApiResponse(true, "Employee created successfully", employee),
            statusCodeRef
          );
        }

        if (action === "CreateProject") {
          const project = await createProject(body ?? {});
          // Send email notification for project creation
          await notifyProjectCreated(project);
          return sendJson(response, 201, project, statusCodeRef);
        }

        if (action === "CreateProjectEmployee") {
          const projectEmployee = await createProjectEmployee(body ?? {});
          // Send email notification to the assigned employee
          await notifyAssignmentCreated(projectEmployee);
          return sendJson(response, 201, projectEmployee, statusCodeRef);
        }

        if (action === "RequestApproval") {
          const projectId = Number(body?.projectId);
          if (!projectId) {
            return sendJson(
              response,
              400,
              createApiResponse(
                false,
                "Invalid projectId for approval request"
              ),
              statusCodeRef
            );
          }
          try {
            const project = await transitionProjectApproval(
              projectId,
              "request",
              body ?? {}
            );
            await notifyApprovalChange(project, "request");
            return sendJson(response, 200, project, statusCodeRef);
          } catch (error) {
            if (error?.message === "Project not found") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        if (action === "ApproveProject") {
          const projectId = Number(body?.projectId);
          if (!projectId) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid projectId for approval"),
              statusCodeRef
            );
          }
          try {
            const project = await transitionProjectApproval(
              projectId,
              "approve",
              body ?? {}
            );
            await notifyApprovalChange(project, "approve");
            return sendJson(response, 200, project, statusCodeRef);
          } catch (error) {
            if (error?.message === "Project not found") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        if (action === "RejectProject") {
          const projectId = Number(body?.projectId);
          if (!projectId) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid projectId for rejection"),
              statusCodeRef
            );
          }
          try {
            const project = await transitionProjectApproval(
              projectId,
              "reject",
              body ?? {}
            );
            await notifyApprovalChange(project, "reject");
            return sendJson(response, 200, project, statusCodeRef);
          } catch (error) {
            if (error?.message === "Project not found") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        if (action === "ResetProjectApproval") {
          const projectId = Number(body?.projectId);
          if (!projectId) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid projectId for reset"),
              statusCodeRef
            );
          }
          try {
            const project = await transitionProjectApproval(
              projectId,
              "reset",
              body ?? {}
            );
            await notifyApprovalChange(project, "reset");
            return sendJson(response, 200, project, statusCodeRef);
          } catch (error) {
            if (error?.message === "Project not found") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        if (action === "AddReviewerComment") {
          const projectId = Number(body?.projectId);
          if (!projectId) {
            return sendJson(
              response,
              400,
              createApiResponse(
                false,
                "Invalid projectId for reviewer comment"
              ),
              statusCodeRef
            );
          }
          try {
            const project = await addProjectReviewerComment(projectId, body);
            // Send email notification for new reviewer comment
            await notifyReviewerComment(project, body);
            return sendJson(response, 200, project, statusCodeRef);
          } catch (error) {
            if (error?.message === "Project not found") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        if (action === "ResolveReviewerComment") {
          const projectId = Number(body?.projectId);
          const commentId = body?.commentId;
          if (!projectId || !commentId) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid project or comment identifier"),
              statusCodeRef
            );
          }
          try {
            const project = await resolveProjectReviewerComment(
              projectId,
              commentId,
              body ?? {}
            );
            return sendJson(response, 200, project, statusCodeRef);
          } catch (error) {
            if (error?.message === "Project not found") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project not found"),
                statusCodeRef
              );
            }
            if (error?.message === "Reviewer comment not found") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Reviewer comment not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        break;
      }

      case "PUT": {
        const body = await readRequestBody(request);

        if (action === "UpdateEmployee") {
          const employeeId = Number(rawId || url.searchParams.get("id"));
          if (!employeeId || isNaN(employeeId)) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid employee identifier"),
              statusCodeRef
            );
          }
          try {
            const employee = await updateEmployee(employeeId, body ?? {});
            // Send email notification for employee update
            await notifyEmployeeUpdated(employee);
            return sendJson(
              response,
              200,
              createApiResponse(
                true,
                "Employee updated successfully",
                employee
              ),
              statusCodeRef
            );
          } catch (error) {
            if (error?.code === "P2025") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Employee not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        if (action === "UpdateProject") {
          const projectId = Number(rawId || url.searchParams.get("id"));
          if (!projectId || isNaN(projectId)) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid project identifier"),
              statusCodeRef
            );
          }
          try {
            const project = await updateProject(projectId, body ?? {});
            // Send email notification for project update
            await notifyProjectUpdated(project);
            return sendJson(response, 200, project, statusCodeRef);
          } catch (error) {
            if (error?.code === "P2025") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        if (action === "UpdateProjectEmployee") {
          const empProjectId = Number(rawId || url.searchParams.get("id"));
          if (!empProjectId || isNaN(empProjectId)) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid project employee identifier"),
              statusCodeRef
            );
          }
          try {
            const projectEmployee = await updateProjectEmployee(
              empProjectId,
              body ?? {}
            );
            // Send email notification for assignment update
            await notifyAssignmentUpdated(projectEmployee);
            return sendJson(response, 200, projectEmployee, statusCodeRef);
          } catch (error) {
            if (error?.code === "P2025") {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project employee not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        break;
      }

      case "DELETE": {
        if (action === "DeleteEmployee") {
          const employeeId = Number(rawId || url.searchParams.get("id"));
          if (!employeeId || isNaN(employeeId)) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid employee identifier"),
              statusCodeRef
            );
          }
          try {
            const deletedEmployee = await deleteEmployee(employeeId);
            // Send email notification for employee deletion
            await notifyEmployeeDeleted(deletedEmployee);
            return sendJson(
              response,
              200,
              createApiResponse(true, "Employee deleted successfully"),
              statusCodeRef
            );
          } catch (error) {
            if (
              error?.code === "P2025" ||
              error?.message?.includes("not found")
            ) {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Employee not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        if (action === "DeleteProject") {
          const projectId = Number(rawId || url.searchParams.get("id"));
          if (!projectId || isNaN(projectId)) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid project identifier"),
              statusCodeRef
            );
          }
          try {
            // Fetch stakeholders before deletion for notification
            let projectRecipients = { to: [], cc: [], bcc: [] };
            try {
              projectRecipients = await getProjectStakeholderEmails(projectId);
            } catch (error) {
                          }

            const deletedProject = await deleteProject(projectId);
            // Send email notification for project deletion
            await notifyProjectDeleted(deletedProject, projectRecipients);
            return sendJson(
              response,
              200,
              createApiResponse(true, "Project deleted successfully"),
              statusCodeRef
            );
          } catch (error) {
            if (
              error?.code === "P2025" ||
              error?.message?.includes("not found")
            ) {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        if (action === "DeleteProjectEmployee") {
          const empProjectId = Number(rawId || url.searchParams.get("id"));
          if (!empProjectId || isNaN(empProjectId)) {
            return sendJson(
              response,
              400,
              createApiResponse(false, "Invalid project employee identifier"),
              statusCodeRef
            );
          }
          try {
            const deletedAssignment = await deleteProjectEmployee(empProjectId);
            // Send email notification for assignment deletion
            await notifyAssignmentDeleted(deletedAssignment);
            return sendJson(
              response,
              200,
              createApiResponse(true, "Project employee deleted successfully"),
              statusCodeRef
            );
          } catch (error) {
            if (
              error?.code === "P2025" ||
              error?.message?.includes("not found")
            ) {
              return sendJson(
                response,
                404,
                createApiResponse(false, "Project employee not found"),
                statusCodeRef
              );
            }
            throw error;
          }
        }

        break;
      }

      default:
        break;
    }

    statusCodeRef.value = 404;
    return sendJson(
      response,
      404,
      createApiResponse(false, "Endpoint not implemented"),
      statusCodeRef
    );
  } catch (err) {
    error = err;
    statusCodeRef.value = 500;
    console.error("Employee management handler error:", err);
    captureApiException(err, {
      action: action || "unknown",
      method,
    });
    return sendJson(
      response,
      500,
      createApiResponse(false, err.message || "Internal server error"),
      statusCodeRef
    );
  } finally {
    // Log the request (skip logging for GetApiStatus to avoid recursion)
    if (action !== "GetApiStatus") {
      const responseTime = Date.now() - requestStartTime;
      logRequest({
        endpoint: action || "unknown",
        method,
        status: statusCodeRef.value,
        responseTime,
        error,
      });
    }
  }
}
