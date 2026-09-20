import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import { hashPassword } from '../auth/auth.password.js';
import { AdminRepository } from './admin.repository.js';
import type { CertificateIssuanceService } from '../certificates/certificate-issuance.service.js';
import type {
  AdminAssignmentsData,
  AdminDashboardData,
  AdminDashboardModule,
  AdminDashboardTrainee,
  AdminProgressData,
  AdminUsersData,
  CreateAssignmentInput,
  CreateTraineeInput,
  UpdateTraineeInput,
} from './admin.types.js';

export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly certificateIssuance: CertificateIssuanceService,
  ) {}

  traineeExists(id: number) {
    return Number.isInteger(id) && id > 0
      ? this.repository.traineeExistsForAssignment(id)
      : Promise.resolve(false);
  }

  async dashboard(user: AuthUser): Promise<AdminDashboardData> {
    const [summaryRow, traineeRows, moduleRows] = await Promise.all([
      this.repository.summary(),
      this.repository.recentTrainees(),
      this.repository.moduleOverview(),
    ]);

    const completionRate =
      summaryRow.activeAssignments === 0
        ? 0
        : Math.round(
            (summaryRow.completedAssignments / summaryRow.activeAssignments) *
              100,
          );

    const trainees: AdminDashboardTrainee[] = traineeRows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      jobRole: row.jobRole,
      isActive: row.isActive,
      assignedCount: row.assignedCount,
      completedCount: row.completedCount,
      progressPercentage: Number(row.progressPercentage),
      latestAssessmentScore:
        row.latestAssessmentScore === null
          ? null
          : Number(row.latestAssessmentScore),
      latestAssessmentPassed: row.latestAssessmentPassed,
      certificateIssued: row.certificateIssued,
    }));

    const modules: AdminDashboardModule[] = moduleRows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      assignedCount: row.assignedCount,
      completedCount: row.completedCount,
      averageProgress: Number(row.averageProgress),
    }));

    return {
      administrator: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      summary: {
        ...summaryRow,
        completionRate,
      },
      trainees,
      modules,
    };
  }

  async users(): Promise<AdminUsersData> {
    const [rows, jobRoles, trainingModules] = await Promise.all([
      this.repository.users(),
      this.repository.jobRoles(),
      this.repository.assignmentModules(),
    ]);
    const users = rows.map((row) => ({
      ...row,
      progressPercentage: Number(row.progressPercentage),
    }));
    return {
      summary: {
        total: users.length,
        active: users.filter((user) => user.isActive).length,
        inactive: users.filter((user) => !user.isActive).length,
        unassignedJobRole: users.filter((user) => user.jobRoleId === null)
          .length,
      },
      jobRoles,
      trainingModules,
      users,
    };
  }

  private validatePerson(
    input: Pick<
      UpdateTraineeInput,
      'firstName' | 'lastName' | 'email' | 'jobRoleId' | 'isActive'
    >,
  ) {
    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!firstName || !lastName)
      throw new HttpError(
        400,
        'First name and last name are required.',
        'INVALID_USER',
      );
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(
        400,
        'Enter a valid email address.',
        'INVALID_EMAIL',
      );
    if (typeof input.isActive !== 'boolean')
      throw new HttpError(
        400,
        'Account status is required.',
        'INVALID_STATUS',
      );
    if (
      input.jobRoleId !== null &&
      (!Number.isInteger(input.jobRoleId) || input.jobRoleId <= 0)
    )
      throw new HttpError(
        400,
        'Select a valid job role.',
        'INVALID_JOB_ROLE',
      );
    return {
      firstName,
      lastName,
      email,
      jobRoleId: input.jobRoleId,
      isActive: input.isActive,
    };
  }

  async createTrainee(input: CreateTraineeInput) {
    const clean = this.validatePerson(input);
    if (
      clean.jobRoleId !== null &&
      !(await this.repository.jobRoleExists(clean.jobRoleId))
    )
      throw new HttpError(
        400,
        'The selected job role does not exist.',
        'INVALID_JOB_ROLE',
      );
    if (
      typeof input.password !== 'string' ||
      input.password.length < 12 ||
      Buffer.byteLength(input.password, 'utf8') > 72
    )
      throw new HttpError(
        400,
        'Initial password must contain at least 12 characters and at most 72 UTF-8 bytes.',
        'INVALID_PASSWORD',
      );
    try {
      const id = await this.repository.createTrainee({
        ...clean,
        passwordHash: await hashPassword(input.password),
      });
      return { id };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === '23505'
      )
        throw new HttpError(
          409,
          'A user with that email address already exists.',
          'EMAIL_EXISTS',
        );
      throw error;
    }
  }

  async updateTrainee(user: AuthUser, id: number, input: UpdateTraineeInput) {
    if (!Number.isInteger(id) || id <= 0)
      throw new HttpError(
        400,
        'Invalid trainee identifier.',
        'INVALID_USER_ID',
      );
    const clean = this.validatePerson(input);
    if (!Array.isArray(input.requiredTrainingModuleIds))
      throw new HttpError(400, 'Required training selections are required.', 'INVALID_REQUIRED_TRAINING');
    const requiredTrainingModuleIds = [...new Set(input.requiredTrainingModuleIds)];
    if (requiredTrainingModuleIds.some((moduleId) => !Number.isInteger(moduleId) || moduleId <= 0))
      throw new HttpError(400, 'Select valid required training modules.', 'INVALID_REQUIRED_TRAINING');
    if ((await this.repository.activeTrainingModuleCount(requiredTrainingModuleIds)) !== requiredTrainingModuleIds.length)
      throw new HttpError(400, 'One or more selected training modules are unavailable.', 'INVALID_REQUIRED_TRAINING');
    if (
      clean.jobRoleId !== null &&
      !(await this.repository.jobRoleExists(clean.jobRoleId))
    )
      throw new HttpError(
        400,
        'The selected job role does not exist.',
        'INVALID_JOB_ROLE',
      );
    try {
      if (!(await this.repository.updateTraineeWithRequirements(id, clean, requiredTrainingModuleIds, user.id)))
        throw new HttpError(
          404,
          'Trainee account not found.',
          'USER_NOT_FOUND',
        );
      await this.certificateIssuance.issueIfEligible(id);
      return { id };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === '23505'
      )
        throw new HttpError(
          409,
          'A user with that email address already exists.',
          'EMAIL_EXISTS',
        );
      throw error;
    }
  }

  async assignments(): Promise<AdminAssignmentsData> {
    const [rows, trainees, modules] = await Promise.all([
      this.repository.assignments(),
      this.repository.assignmentTrainees(),
      this.repository.assignmentModules(),
    ]);

    const assignments = rows.map((row) => ({
      id: row.id,
      traineeId: row.traineeId,
      traineeFirstName: row.traineeFirstName,
      traineeLastName: row.traineeLastName,
      traineeEmail: row.traineeEmail,
      traineeJobRole: row.traineeJobRole,
      traineeIsActive: row.traineeIsActive,
      trainingModuleId: row.trainingModuleId,
      trainingModuleTitle: row.trainingModuleTitle,
      trainingModuleSlug: row.trainingModuleSlug,
      required: row.required,
      status: row.status,
      assignedAt: row.assignedAt.toISOString(),
      dueAt: row.dueAt?.toISOString() ?? null,
      assignedByFirstName: row.assignedByFirstName,
      assignedByLastName: row.assignedByLastName,
      progressPercentage: Number(row.progressPercentage),
      completedAt: row.completedAt?.toISOString() ?? null,
    }));

    const active = assignments.filter(
      (assignment) => assignment.status === 'active',
    );

    return {
      summary: {
        total: assignments.length,
        active: active.length,
        required: active.filter((assignment) => assignment.required).length,
        optional: active.filter((assignment) => !assignment.required).length,
        completed: active.filter((assignment) => assignment.completedAt !== null)
          .length,
      },
      trainees,
      modules,
      assignments,
    };
  }

  async progress(): Promise<AdminProgressData> {
    const rows = await this.repository.progressRecords();

    const records = rows.map((row) => ({
      assignmentId: row.assignmentId,
      traineeId: row.traineeId,
      traineeFirstName: row.traineeFirstName,
      traineeLastName: row.traineeLastName,
      traineeEmail: row.traineeEmail,
      traineeJobRole: row.traineeJobRole,
      traineeIsActive: row.traineeIsActive,
      trainingModuleId: row.trainingModuleId,
      trainingModuleTitle: row.trainingModuleTitle,
      trainingModuleSlug: row.trainingModuleSlug,
      required: row.required,
      assignmentStatus: row.assignmentStatus,
      progressPercentage: Number(row.progressPercentage),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
      learningCompleted: row.learningCompleted,
      learningTotal: row.learningTotal,
      scenarioCompleted: row.scenarioCompleted,
      scenarioTotal: row.scenarioTotal,
      assessmentTotal: row.assessmentTotal,
      assessmentPassed: row.assessmentPassed,
      assessmentAttempts: row.assessmentAttempts,
      latestAssessmentAttemptNumber: row.latestAssessmentAttemptNumber,
      latestAssessmentScore:
        row.latestAssessmentScore === null
          ? null
          : Number(row.latestAssessmentScore),
      latestAssessmentPassed: row.latestAssessmentPassed,
      latestAssessmentSubmittedAt:
        row.latestAssessmentSubmittedAt?.toISOString() ?? null,
      certificateIssued: row.certificateNumber !== null,
      certificateNumber: row.certificateNumber,
      certificateIssuedAt: row.certificateIssuedAt?.toISOString() ?? null,
    }));

    const active = records.filter(
      (record) => record.assignmentStatus === 'active',
    );
    const certificateTrainees = new Set(
      records
        .filter((record) => record.certificateIssued)
        .map((record) => record.traineeId),
    );
    const modules = Array.from(
      new Map(
        records.map((record) => [
          record.trainingModuleId,
          {
            id: record.trainingModuleId,
            title: record.trainingModuleTitle,
            slug: record.trainingModuleSlug,
          },
        ]),
      ).values(),
    ).sort((left, right) => left.title.localeCompare(right.title));

    return {
      summary: {
        activeAssignments: active.length,
        completedAssignments: active.filter(
          (record) => record.completedAt !== null,
        ).length,
        inProgressAssignments: active.filter(
          (record) =>
            record.progressPercentage > 0 && record.progressPercentage < 100,
        ).length,
        notStartedAssignments: active.filter(
          (record) => record.progressPercentage === 0,
        ).length,
        assessmentPassedAssignments: active.filter(
          (record) =>
            record.assessmentTotal > 0 &&
            record.assessmentPassed === record.assessmentTotal,
        ).length,
        certificatesIssued: certificateTrainees.size,
      },
      modules,
      records,
    };
  }

  async createAssignment(user: AuthUser, input: CreateAssignmentInput) {
    if (!Number.isInteger(input.traineeId) || input.traineeId <= 0)
      throw new HttpError(
        400,
        'Select a valid trainee.',
        'INVALID_TRAINEE',
      );
    if (!Number.isInteger(input.trainingModuleId) || input.trainingModuleId <= 0)
      throw new HttpError(
        400,
        'Select a valid training module.',
        'INVALID_TRAINING_MODULE',
      );
    if (typeof input.required !== 'boolean')
      throw new HttpError(
        400,
        'Choose whether this training is required or optional.',
        'INVALID_ASSIGNMENT_TYPE',
      );

    if (!(await this.repository.traineeExistsForAssignment(input.traineeId)))
      throw new HttpError(
        404,
        'Trainee account not found.',
        'TRAINEE_NOT_FOUND',
      );
    if (
      !(await this.repository.activeTrainingModuleExists(
        input.trainingModuleId,
      ))
    )
      throw new HttpError(
        404,
        'Active training module not found.',
        'TRAINING_MODULE_NOT_FOUND',
      );

    try {
      const id = await this.repository.createAssignment({
        traineeId: input.traineeId,
        trainingModuleId: input.trainingModuleId,
        assignedBy: user.id,
        required: input.required,
      });
      return { id };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === '23505'
      )
        throw new HttpError(
          409,
          'That training module is already assigned to this trainee.',
          'ASSIGNMENT_EXISTS',
        );
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === '23514'
      )
        throw new HttpError(
          400,
          'The training assignment does not satisfy the current account rules.',
          'INVALID_ASSIGNMENT',
        );
      throw error;
    }
  }
}
