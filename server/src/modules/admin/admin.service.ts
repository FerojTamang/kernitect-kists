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
  AdminDashboardAttention,
  AdminProgressData,
  AdminUsersData,
  CreateAssignmentInput,
  CreateTraineeInput,
  UpdateTraineeInput,
  SaveAssessmentQuestionInput,
  SaveTrainingModuleInput,
} from './admin.types.js';

type DashboardProgressRow = Awaited<
  ReturnType<AdminRepository['progressRecords']>
>[number];

function assignmentComplete(row: DashboardProgressRow): boolean {
  return row.completedAt !== null && Number(row.progressPercentage) === 100;
}

function traineeCurrentStage(rows: DashboardProgressRow[]): string {
  const active = rows.filter((row) => row.assignmentStatus === 'active');
  if (active.length === 0) return 'Not assigned';

  const outstanding = active.filter((row) => !assignmentComplete(row));
  if (outstanding.length === 0) return 'Complete';

  const current = outstanding.find((row) => row.required) ?? outstanding[0]!;
  if (
    current.learningTotal === 0 ||
    current.learningCompleted < current.learningTotal
  )
    return 'Learning';
  if (current.scenarioTotal > current.scenarioCompleted) return '360° Scenario';
  if (current.assessmentTotal > current.assessmentPassed)
    return 'Final Assessment';
  return 'In progress';
}

function assignmentProgressStage(row: DashboardProgressRow): string {
  const started =
    row.startedAt !== null ||
    Number(row.progressPercentage) > 0 ||
    row.learningCompleted > 0 ||
    row.scenarioCompleted > 0 ||
    row.assessmentPassed > 0;

  if (!started) return 'Not started';
  if (row.learningTotal > row.learningCompleted) return 'Learning';
  if (row.scenarioTotal > row.scenarioCompleted) return '360° Scenario';
  if (row.assessmentTotal > row.assessmentPassed) return 'Final Assessment';
  if (row.learningTotal + row.scenarioTotal + row.assessmentTotal > 0)
    return 'Completed';
  return 'Learning';
}

function assignmentDisplayPercentage(
  row: DashboardProgressRow,
  stage: string,
): number {
  if (stage === 'Completed') return 100;

  const storedPercentage = Number(row.progressPercentage);
  if (storedPercentage < 100) return storedPercentage;

  // A newly required stage can make a historical 100% progress row stale.
  // Reconcile its display from the same stage evidence used by Progress & results.
  const stageEvidence: Array<[number, number]> = [
    [row.learningCompleted, row.learningTotal],
    [row.scenarioCompleted, row.scenarioTotal],
    [row.assessmentPassed, row.assessmentTotal],
  ];
  const requiredStages = stageEvidence.filter(([, total]) => total > 0);
  if (requiredStages.length === 0) return 0;
  return Math.round(
    (100 *
      requiredStages.reduce(
        (sum, [completed, total]) => sum + Math.min(completed, total) / total,
        0,
      )) /
      requiredStages.length,
  );
}

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
    const [summaryRow, traineeRows, moduleRows, progressRows] =
      await Promise.all([
        this.repository.summary(),
        this.repository.recentTrainees(),
        this.repository.moduleOverview(),
        this.repository.progressRecords(),
      ]);

    const activeProgress = progressRows.filter(
      (row) => row.assignmentStatus === 'active',
    );
    const progressByTrainee = new Map<number, DashboardProgressRow[]>();
    for (const row of activeProgress) {
      const rows = progressByTrainee.get(row.traineeId) ?? [];
      rows.push(row);
      progressByTrainee.set(row.traineeId, rows);
    }

    const attention: AdminDashboardAttention = {
      traineesInProgress: new Set(
        activeProgress
          .filter(
            (row) =>
              row.traineeIsActive &&
              !assignmentComplete(row) &&
              (row.startedAt !== null || Number(row.progressPercentage) > 0),
          )
          .map((row) => row.traineeId),
      ).size,
      assessmentsAwaitingCompletion: activeProgress.filter(
        (row) =>
          !assignmentComplete(row) &&
          row.learningTotal > 0 &&
          row.learningCompleted === row.learningTotal &&
          row.scenarioTotal > 0 &&
          row.scenarioCompleted === row.scenarioTotal &&
          row.assessmentTotal > 0 &&
          row.assessmentPassed < row.assessmentTotal,
      ).length,
    };

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
      currentStage: traineeCurrentStage(progressByTrainee.get(row.id) ?? []),
    }));

    const modules: AdminDashboardModule[] = moduleRows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      assignedCount: row.assignedCount,
      completedCount: row.completedCount,
      completionRate:
        row.assignedCount === 0
          ? 0
          : Math.round((row.completedCount / row.assignedCount) * 100),
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
      attention,
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

  async trainingLibrary() {
    const modules = (await this.repository.trainingLibrary()).map((module) => ({
      ...module,
      passPercentage:
        module.passPercentage === null ? null : Number(module.passPercentage),
    }));
    return {
      summary: {
        totalModules: modules.length,
        activeModules: modules.filter((module) => module.isActive).length,
        draftModules: modules.filter((module) => !module.isActive).length,
        assessmentQuestions: modules.reduce(
          (sum, module) => sum + module.questionCount,
          0,
        ),
      },
      modules,
    };
  }

  async trainingModule(id: number) {
    this.validateId(id, 'training module');
    const [module, library] = await Promise.all([
      this.repository.trainingModule(id),
      this.repository.trainingLibrary(),
    ]);
    if (!module)
      throw new HttpError(
        404,
        'Training module not found.',
        'MODULE_NOT_FOUND',
      );
    const [learningSections, scenarios, assessmentRows] = await Promise.all([
      this.repository.learningSections(id),
      this.repository.moduleScenarios(id),
      this.repository.moduleAssessments(id),
    ]);
    const questionRows = await this.repository.assessmentQuestions(
      assessmentRows.map((assessment) => assessment.id),
    );
    const assessments = assessmentRows.map((assessment) => {
      const questions = new Map<
        number,
        {
          id: number;
          questionText: string;
          sequenceOrder: number;
          options: Array<{
            id: number;
            optionText: string;
            isCorrect: boolean;
            sequenceOrder: number;
          }>;
        }
      >();
      for (const row of questionRows.filter(
        (question) => question.assessmentId === assessment.id,
      )) {
        const question = questions.get(row.questionId) ?? {
          id: row.questionId,
          questionText: row.questionText,
          sequenceOrder: row.questionOrder,
          options: [],
        };
        question.options.push({
          id: row.optionId,
          optionText: row.optionText,
          isCorrect: row.isCorrect,
          sequenceOrder: row.optionOrder,
        });
        questions.set(row.questionId, question);
      }
      return {
        ...assessment,
        passPercentage: Number(assessment.passPercentage),
        questions: [...questions.values()],
      };
    });
    const summary = library.find((item) => item.id === id)!;
    return {
      ...summary,
      passPercentage:
        summary.passPercentage === null ? null : Number(summary.passPercentage),
      learningSections,
      scenarios,
      assessments,
    };
  }

  async createTrainingModule(input: SaveTrainingModuleInput) {
    const clean = this.validateModule(input, false);
    const slugBase =
      clean.title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'training-module';
    try {
      return {
        id: await this.repository.createTrainingModule({
          ...clean,
          slug: `${slugBase}-${Date.now().toString(36)}`,
        }),
      };
    } catch (error) {
      if (this.isUniqueViolation(error))
        throw new HttpError(
          409,
          'A training module with this title already exists.',
          'MODULE_EXISTS',
        );
      throw error;
    }
  }

  async updateTrainingModule(id: number, input: SaveTrainingModuleInput) {
    this.validateId(id, 'training module');
    const clean = this.validateModule(input, true);
    if (
      !(await this.repository.updateTrainingModule(id, {
        ...clean,
        isActive: input.isActive!,
      }))
    )
      throw new HttpError(
        404,
        'Training module not found.',
        'MODULE_NOT_FOUND',
      );
    return { id };
  }

  async createAssessmentQuestion(
    moduleId: number,
    assessmentId: number,
    input: SaveAssessmentQuestionInput,
  ) {
    await this.assertEditableAssessment(moduleId, assessmentId);
    const clean = this.validateQuestion(input);
    return {
      id: await this.repository.createAssessmentQuestion(
        assessmentId,
        clean.questionText,
        clean.options,
      ),
    };
  }

  async updateAssessmentQuestion(
    moduleId: number,
    assessmentId: number,
    questionId: number,
    input: SaveAssessmentQuestionInput,
  ) {
    await this.assertEditableAssessment(moduleId, assessmentId);
    this.validateId(questionId, 'question');
    if (
      !(await this.repository.questionForAssessment(assessmentId, questionId))
    )
      throw new HttpError(
        404,
        'Assessment question not found.',
        'QUESTION_NOT_FOUND',
      );
    const clean = this.validateQuestion(input);
    await this.repository.updateAssessmentQuestion(
      assessmentId,
      questionId,
      clean.questionText,
      clean.options,
    );
    return { id: questionId };
  }

  async deleteAssessmentQuestion(
    moduleId: number,
    assessmentId: number,
    questionId: number,
  ) {
    await this.assertEditableAssessment(moduleId, assessmentId);
    this.validateId(questionId, 'question');
    if (
      !(await this.repository.deleteAssessmentQuestion(
        assessmentId,
        questionId,
      ))
    )
      throw new HttpError(
        404,
        'Assessment question not found.',
        'QUESTION_NOT_FOUND',
      );
  }

  private validateId(id: number, label: string) {
    if (!Number.isInteger(id) || id <= 0)
      throw new HttpError(400, `Invalid ${label} identifier.`, 'INVALID_ID');
  }
  private validateModule(
    input: SaveTrainingModuleInput,
    requireStatus: boolean,
  ) {
    const title = typeof input?.title === 'string' ? input.title.trim() : '';
    const description =
      typeof input?.description === 'string' ? input.description.trim() : '';
    if (!title || title.length > 160)
      throw new HttpError(
        400,
        'Enter a module title up to 160 characters.',
        'INVALID_MODULE',
      );
    if (description.length > 2000)
      throw new HttpError(
        400,
        'Module description must be 2,000 characters or fewer.',
        'INVALID_MODULE',
      );
    if (requireStatus && typeof input.isActive !== 'boolean')
      throw new HttpError(400, 'Choose a module status.', 'INVALID_MODULE');
    return { title, description };
  }
  private validateQuestion(input: SaveAssessmentQuestionInput) {
    const questionText =
      typeof input?.questionText === 'string' ? input.questionText.trim() : '';
    if (!questionText || questionText.length > 1000)
      throw new HttpError(
        400,
        'Enter a question up to 1,000 characters.',
        'INVALID_QUESTION',
      );
    if (
      !Array.isArray(input.options) ||
      input.options.length < 2 ||
      input.options.length > 8
    )
      throw new HttpError(
        400,
        'Provide between 2 and 8 answer options.',
        'INVALID_QUESTION',
      );
    const options = input.options.map((option) => ({
      optionText:
        typeof option?.optionText === 'string' ? option.optionText.trim() : '',
      isCorrect: option?.isCorrect === true,
    }));
    if (
      options.some(
        (option) => !option.optionText || option.optionText.length > 500,
      )
    )
      throw new HttpError(
        400,
        'Every answer option is required and must be 500 characters or fewer.',
        'INVALID_QUESTION',
      );
    if (options.filter((option) => option.isCorrect).length !== 1)
      throw new HttpError(
        400,
        'Select exactly one correct answer.',
        'INVALID_QUESTION',
      );
    return { questionText, options };
  }
  private async assertEditableAssessment(
    moduleId: number,
    assessmentId: number,
  ) {
    this.validateId(moduleId, 'training module');
    this.validateId(assessmentId, 'assessment');
    const assessment = await this.repository.assessmentForModule(
      moduleId,
      assessmentId,
    );
    if (!assessment)
      throw new HttpError(404, 'Assessment not found.', 'ASSESSMENT_NOT_FOUND');
    if (assessment.hasAttempts)
      throw new HttpError(
        409,
        'Questions cannot be changed after assessment attempts have been recorded.',
        'ASSESSMENT_HISTORY_EXISTS',
      );
  }
  private isUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
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
      throw new HttpError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
    if (typeof input.isActive !== 'boolean')
      throw new HttpError(400, 'Account status is required.', 'INVALID_STATUS');
    if (
      input.jobRoleId !== null &&
      (!Number.isInteger(input.jobRoleId) || input.jobRoleId <= 0)
    )
      throw new HttpError(400, 'Select a valid job role.', 'INVALID_JOB_ROLE');
    return {
      firstName,
      lastName,
      email,
      jobRoleId: input.jobRoleId,
      isActive: input.isActive,
    };
  }

  async createTrainee(input: CreateTraineeInput, assignedBy?: number) {
    const clean = this.validatePerson(input);
    if (
      input.requiredTrainingModuleIds !== undefined &&
      !Array.isArray(input.requiredTrainingModuleIds)
    )
      throw new HttpError(
        400,
        'Select valid training modules.',
        'INVALID_REQUIRED_TRAINING',
      );
    const requiredTrainingModuleIds = [
      ...new Set(input.requiredTrainingModuleIds ?? []),
    ];
    if (
      requiredTrainingModuleIds.some(
        (moduleId) => !Number.isInteger(moduleId) || moduleId <= 0,
      ) ||
      (requiredTrainingModuleIds.length > 0 &&
        (!Number.isInteger(assignedBy) || (assignedBy ?? 0) <= 0))
    )
      throw new HttpError(
        400,
        'Select valid training modules.',
        'INVALID_REQUIRED_TRAINING',
      );
    if (
      requiredTrainingModuleIds.length > 0 &&
      (await this.repository.activeTrainingModuleCount(
        requiredTrainingModuleIds,
      )) !== requiredTrainingModuleIds.length
    )
      throw new HttpError(
        400,
        'One or more selected training modules are unavailable.',
        'INVALID_REQUIRED_TRAINING',
      );
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
      const account = {
        ...clean,
        passwordHash: await hashPassword(input.password),
      };
      const id = requiredTrainingModuleIds.length
        ? await this.repository.createTraineeWithAssignments(
            account,
            requiredTrainingModuleIds,
            assignedBy!,
          )
        : await this.repository.createTrainee(account);
      if (id === null)
        throw new HttpError(
          400,
          'One or more selected training modules are unavailable.',
          'INVALID_REQUIRED_TRAINING',
        );
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
      throw new HttpError(
        400,
        'Required training selections are required.',
        'INVALID_REQUIRED_TRAINING',
      );
    const requiredTrainingModuleIds = [
      ...new Set(input.requiredTrainingModuleIds),
    ];
    if (
      requiredTrainingModuleIds.some(
        (moduleId) => !Number.isInteger(moduleId) || moduleId <= 0,
      )
    )
      throw new HttpError(
        400,
        'Select valid required training modules.',
        'INVALID_REQUIRED_TRAINING',
      );
    if (
      (await this.repository.activeTrainingModuleCount(
        requiredTrainingModuleIds,
      )) !== requiredTrainingModuleIds.length
    )
      throw new HttpError(
        400,
        'One or more selected training modules are unavailable.',
        'INVALID_REQUIRED_TRAINING',
      );
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
      if (
        !(await this.repository.updateTraineeWithRequirements(
          id,
          clean,
          requiredTrainingModuleIds,
          user.id,
        ))
      )
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
    const [rows, progressRows, trainees, modules] = await Promise.all([
      this.repository.assignments(),
      this.repository.progressRecords(),
      this.repository.assignmentTrainees(),
      this.repository.assignmentModules(),
    ]);

    const progressByAssignment = new Map(
      progressRows.map((row) => [row.assignmentId, row]),
    );

    const assignments = rows.map((row) => {
      const progress = progressByAssignment.get(row.id);
      const progressStage = progress
        ? assignmentProgressStage(progress)
        : 'Not started';
      return {
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
        progressPercentage: progress
          ? assignmentDisplayPercentage(progress, progressStage)
          : Number(row.progressPercentage),
        completedAt: row.completedAt?.toISOString() ?? null,
        progressStage,
      };
    });

    const active = assignments.filter(
      (assignment) => assignment.status === 'active',
    );

    return {
      summary: {
        total: assignments.length,
        active: active.length,
        required: active.filter((assignment) => assignment.required).length,
        optional: active.filter((assignment) => !assignment.required).length,
        completed: active.filter(
          (assignment) => assignment.progressStage === 'Completed',
        ).length,
      },
      trainees,
      modules,
      assignments,
    };
  }

  async progress(): Promise<AdminProgressData> {
    const rows = await this.repository.progressRecords();

    const records = rows.map((row) => {
      const progressStage = assignmentProgressStage(row);
      return {
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
        progressPercentage: assignmentDisplayPercentage(row, progressStage),
        progressStage,
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
      };
    });

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
          (record) => record.progressStage === 'Completed',
        ).length,
        inProgressAssignments: active.filter(
          (record) =>
            record.progressStage !== 'Completed' &&
            record.progressStage !== 'Not started',
        ).length,
        notStartedAssignments: active.filter(
          (record) => record.progressStage === 'Not started',
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
      throw new HttpError(400, 'Select a valid trainee.', 'INVALID_TRAINEE');
    if (
      !Number.isInteger(input.trainingModuleId) ||
      input.trainingModuleId <= 0
    )
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
