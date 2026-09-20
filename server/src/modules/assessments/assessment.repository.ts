import type { Pool } from 'pg';
import { inTransaction } from '../../database/transaction.js';
import { CertificateIssuanceService } from '../certificates/certificate-issuance.service.js';
import type {
  AssessmentAttemptSummary,
  AssessmentSubmissionAnswer,
  AssessmentSubmissionResult,
} from './assessment.types.js';

interface AssessmentContextRow {
  assignmentId: number;
  moduleId: number;
  assessmentId: number;
  title: string;
  description: string;
  passPercentage: string;
  sequenceOrder: number;
  activeSectionCount: number;
  completedSectionCount: number;
  activeScenarioCount: number;
  completedScenarioCount: number;
}

interface AssessmentQuestionRow {
  questionId: number;
  questionText: string;
  questionType: 'single_choice' | 'true_false' | 'free_text';
  questionOrder: number;
  optionId: number | null;
  optionText: string | null;
  optionOrder: number | null;
}

interface AssessmentAttemptRow {
  id: number;
  attemptNumber: number;
  scorePercentage: string;
  passPercentage: string;
  passed: boolean;
  submittedAt: Date;
}

interface SubmissionContextRow {
  assignmentId: number;
  traineeId: number;
  moduleId: number;
  assessmentId: number;
}

interface ResponseCorrectnessRow {
  isCorrect: boolean;
}

export class AssessmentRepository {
  private readonly certificateIssuance: CertificateIssuanceService;

  constructor(private readonly database: Pool) {
    this.certificateIssuance = new CertificateIssuanceService(database);
  }

  async findAssessmentContext(
    userId: number,
    assignmentId: number,
  ): Promise<AssessmentContextRow | undefined> {
    const result = await this.database.query<AssessmentContextRow>(
      `SELECT ta.id AS "assignmentId",
        ta.training_module_id AS "moduleId",
        a.id AS "assessmentId",
        a.title,
        a.description,
        a.pass_percentage::text AS "passPercentage",
        a.sequence_order AS "sequenceOrder",
        COUNT(DISTINCT c.id)::int AS "activeSectionCount",
        COUNT(DISTINCT cc.training_content_id)::int AS "completedSectionCount",
        COUNT(DISTINCT s.id)::int AS "activeScenarioCount",
        COUNT(DISTINCT sa.scenario_id)
          FILTER (WHERE sa.completed_at IS NOT NULL)::int AS "completedScenarioCount"
      FROM training_assignments ta
      JOIN training_modules m
        ON m.id = ta.training_module_id
      JOIN assessments a
        ON a.training_module_id = m.id
       AND a.is_active
      LEFT JOIN training_content c
        ON c.training_module_id = m.id
       AND c.is_active
      LEFT JOIN training_content_completion cc
        ON cc.training_assignment_id = ta.id
       AND cc.training_content_id = c.id
      LEFT JOIN scenarios s
        ON s.training_module_id = m.id
       AND s.is_active
      LEFT JOIN scenario_attempts sa
        ON sa.training_assignment_id = ta.id
       AND sa.scenario_id = s.id
      WHERE ta.id = $1
        AND ta.trainee_id = $2
        AND ta.status = 'active'
        AND m.slug = 'manual-handling'
      GROUP BY ta.id, ta.training_module_id, a.id, a.title, a.description,
        a.pass_percentage, a.sequence_order
      ORDER BY a.sequence_order ASC
      LIMIT 1`,
      [assignmentId, userId],
    );

    return result.rows[0];
  }

  async findQuestions(assessmentId: number): Promise<AssessmentQuestionRow[]> {
    const result = await this.database.query<AssessmentQuestionRow>(
      `SELECT q.id AS "questionId",
        q.question_text AS "questionText",
        q.question_type AS "questionType",
        q.sequence_order AS "questionOrder",
        ao.id AS "optionId",
        ao.option_text AS "optionText",
        ao.sequence_order AS "optionOrder"
      FROM questions q
      LEFT JOIN answer_options ao
        ON ao.question_id = q.id
      WHERE q.assessment_id = $1
      ORDER BY q.sequence_order ASC, q.id ASC,
        ao.sequence_order ASC, ao.id ASC`,
      [assessmentId],
    );

    return result.rows;
  }

  async findLatestAttempt(
    assignmentId: number,
    assessmentId: number,
  ): Promise<AssessmentAttemptSummary | null> {
    const result = await this.database.query<AssessmentAttemptRow>(
      `SELECT id,
        attempt_number AS "attemptNumber",
        score_percentage::text AS "scorePercentage",
        pass_percentage_snapshot::text AS "passPercentage",
        passed,
        submitted_at AS "submittedAt"
      FROM assessment_attempts
      WHERE training_assignment_id = $1
        AND assessment_id = $2
        AND submitted_at IS NOT NULL
      ORDER BY attempt_number DESC, id DESC
      LIMIT 1`,
      [assignmentId, assessmentId],
    );

    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          attemptNumber: row.attemptNumber,
          scorePercentage: Number(row.scorePercentage),
          passPercentage: Number(row.passPercentage),
          passed: row.passed,
          submittedAt: row.submittedAt.toISOString(),
        }
      : null;
  }

  async submitAssessment(
    userId: number,
    assignmentId: number,
    assessmentId: number,
    answers: AssessmentSubmissionAnswer[],
  ): Promise<AssessmentSubmissionResult | undefined> {
    const result = await inTransaction(this.database, async (client) => {
      const contextResult = await client.query<SubmissionContextRow>(
        `SELECT ta.id AS "assignmentId",
          ta.trainee_id AS "traineeId",
          ta.training_module_id AS "moduleId",
          a.id AS "assessmentId"
        FROM training_assignments ta
        JOIN assessments a
          ON a.training_module_id = ta.training_module_id
         AND a.id = $3
         AND a.is_active
        WHERE ta.id = $1
          AND ta.trainee_id = $2
          AND ta.status = 'active'
        FOR UPDATE OF ta`,
        [assignmentId, userId, assessmentId],
      );

      const context = contextResult.rows[0];
      if (!context) return undefined;

      const questionCountResult = await client.query<{
        totalQuestions: number;
      }>(
        `SELECT COUNT(*)::int AS "totalQuestions"
        FROM questions
        WHERE assessment_id = $1`,
        [assessmentId],
      );
      const totalQuestions = questionCountResult.rows[0]?.totalQuestions ?? 0;

      if (totalQuestions <= 0 || answers.length !== totalQuestions) {
        return undefined;
      }

      const attemptNumberResult = await client.query<{ attemptNumber: number }>(
        `SELECT (COALESCE(MAX(attempt_number), 0) + 1)::int AS "attemptNumber"
        FROM assessment_attempts
        WHERE trainee_id = $1
          AND assessment_id = $2`,
        [context.traineeId, assessmentId],
      );
      const attemptNumber = attemptNumberResult.rows[0]!.attemptNumber;

      const attemptResult = await client.query<{ id: number }>(
        `INSERT INTO assessment_attempts (
          trainee_id,
          training_assignment_id,
          training_module_id,
          assessment_id,
          attempt_number
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [
          context.traineeId,
          context.assignmentId,
          context.moduleId,
          context.assessmentId,
          attemptNumber,
        ],
      );
      const attemptId = attemptResult.rows[0]!.id;

      const responseResult = await client.query<ResponseCorrectnessRow>(
        `WITH input_answers AS (
          SELECT *
          FROM jsonb_to_recordset($3::jsonb)
            AS answer("questionId" integer, "optionId" integer)
        )
        INSERT INTO assessment_responses (
          assessment_attempt_id,
          assessment_id,
          question_id,
          selected_answer_option_id,
          is_correct
        )
        SELECT $1::integer,
          $2,
          q.id,
          ao.id,
          ao.is_correct
        FROM input_answers answer
        JOIN questions q
          ON q.id = answer."questionId"
         AND q.assessment_id = $2
        JOIN answer_options ao
          ON ao.id = answer."optionId"
         AND ao.question_id = q.id
        RETURNING is_correct AS "isCorrect"`,
        [attemptId, assessmentId, JSON.stringify(answers)],
      );

      if (responseResult.rows.length !== totalQuestions) {
        throw new Error(
          'Assessment answers changed while submission was in progress.',
        );
      }

      const correctAnswers = responseResult.rows.filter(
        (response) => response.isCorrect,
      ).length;
      const scorePercentage =
        Math.round((correctAnswers / totalQuestions) * 10000) / 100;

      const submittedResult = await client.query<AssessmentAttemptRow>(
        `UPDATE assessment_attempts
        SET submitted_at = clock_timestamp(),
          score_percentage = $2
        WHERE id = $1
          AND submitted_at IS NULL
        RETURNING id,
          attempt_number AS "attemptNumber",
          score_percentage::text AS "scorePercentage",
          pass_percentage_snapshot::text AS "passPercentage",
          passed,
          submitted_at AS "submittedAt"`,
        [attemptId, scorePercentage],
      );

      const submitted = submittedResult.rows[0];
      if (!submitted) {
        throw new Error('Assessment attempt could not be finalized.');
      }

      if (submitted.passed) {
        await client.query(
          `INSERT INTO progress (
            trainee_id,
            training_module_id,
            training_assignment_id,
            percentage,
            started_at,
            completed_at,
            last_accessed_at
          )
          VALUES (
            $1,
            $2,
            $3,
            100,
            clock_timestamp(),
            clock_timestamp(),
            clock_timestamp()
          )
          ON CONFLICT (training_assignment_id) DO UPDATE SET
            percentage = 100,
            started_at = COALESCE(progress.started_at, clock_timestamp()),
            completed_at = COALESCE(progress.completed_at, clock_timestamp()),
            last_accessed_at = clock_timestamp(),
            updated_at = clock_timestamp()`,
          [context.traineeId, context.moduleId, context.assignmentId],
        );
      }

      return {
        assignmentId: context.assignmentId,
        assessmentId: context.assessmentId,
        correctAnswers,
        totalQuestions,
        attempt: {
          id: submitted.id,
          attemptNumber: submitted.attemptNumber,
          scorePercentage: Number(submitted.scorePercentage),
          passPercentage: Number(submitted.passPercentage),
          passed: submitted.passed,
          submittedAt: submitted.submittedAt.toISOString(),
        },
      };
    });

    // Certificate issuance deliberately happens after the assessment transaction
    // commits. The certification trigger takes SHARE table locks while validating
    // eligibility and snapshots immutable evidence. Running issuance after commit
    // lets it see the completed progress and passing attempt as stable state, and
    // avoids mixing those certification locks with the assessment write transaction.
    if (result?.attempt.passed) {
      await this.certificateIssuance.issueIfEligible(userId);
    }

    return result;
  }

}
