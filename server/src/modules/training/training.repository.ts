import type { Pool } from 'pg';
import type { TrainingSection } from './training.types.js';

interface TrainingModuleRow {
  assignmentId: number;
  moduleId: number;
  moduleTitle: string;
  moduleDescription: string;
  hasScenario: boolean;
  percentage: string;
  startedAt: Date | null;
  assignmentCompletedAt: Date | null;
  lastAccessedAt: Date | null;
  sectionId: number | null;
  title: string | null;
  contentType: TrainingSection['contentType'] | null;
  body: string | null;
  resourceReference: string | null;
  sequenceOrder: number | null;
  isActive: boolean | null;
  contentCompletedAt: Date | null;
}

interface FormativeQuestionRow {
  contentId: number;
  questionId: number;
  questionText: string;
  questionOrder: number;
  optionId: number | null;
  optionText: string | null;
  optionOrder: number | null;
  selectedOptionId: number | null;
  answeredCorrectly: boolean;
}

interface ModuleProgressionRow {
  activeScenarioCount: number;
  completedScenarioCount: number;
  scenarioStarted: boolean;
  hasAssessment: boolean;
  assessmentPassed: boolean;
}

export class TrainingRepository {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async findAssignmentDetail(
    userId: number,
    assignmentId: number,
  ): Promise<TrainingModuleRow[]> {
    const result = await this.database.query<TrainingModuleRow>(
      `SELECT a.id AS "assignmentId", m.id AS "moduleId", m.title AS "moduleTitle",
        m.description AS "moduleDescription",
        EXISTS (SELECT 1 FROM scenarios s WHERE s.training_module_id = m.id AND s.is_active) AS "hasScenario",
        COALESCE(p.percentage, 0)::text AS percentage,
        p.started_at AS "startedAt", p.completed_at AS "assignmentCompletedAt",
        p.last_accessed_at AS "lastAccessedAt",
        c.id AS "sectionId", c.title, c.content_type AS "contentType",
        c.body, c.resource_reference AS "resourceReference",
        c.sequence_order AS "sequenceOrder", c.is_active AS "isActive",
        cc.completed_at AS "contentCompletedAt"
      FROM training_assignments a
      JOIN training_modules m ON m.id = a.training_module_id
      LEFT JOIN progress p ON p.training_assignment_id = a.id
      LEFT JOIN training_content c ON c.training_module_id = m.id AND c.is_active
      LEFT JOIN training_content_completion cc
        ON cc.training_assignment_id = a.id AND cc.training_content_id = c.id
      WHERE a.id = $1 AND a.trainee_id = $2 AND a.status = 'active'
        AND m.is_active
      ORDER BY c.sequence_order ASC, c.id ASC`,
      [assignmentId, userId],
    );
    return result.rows;
  }

  async findFormativeQuestions(
    userId: number,
    assignmentId: number,
  ): Promise<FormativeQuestionRow[]> {
    const result = await this.database.query<FormativeQuestionRow>(
      `SELECT c.id AS "contentId", fq.id AS "questionId",
        fq.question_text AS "questionText", fq.sequence_order AS "questionOrder",
        fo.id AS "optionId", fo.option_text AS "optionText",
        fo.sequence_order AS "optionOrder",
        fr.selected_option_id AS "selectedOptionId",
        COALESCE(fr.is_correct, false) AS "answeredCorrectly"
      FROM training_assignments a
      JOIN training_modules m ON m.id = a.training_module_id
      JOIN training_content c ON c.training_module_id = m.id AND c.is_active
      JOIN formative_questions fq ON fq.training_content_id = c.id
      LEFT JOIN formative_answer_options fo ON fo.formative_question_id = fq.id
      LEFT JOIN formative_responses fr
        ON fr.training_assignment_id = a.id AND fr.formative_question_id = fq.id
      WHERE a.id = $1 AND a.trainee_id = $2 AND a.status = 'active'
        AND m.is_active
      ORDER BY c.sequence_order, fq.sequence_order, fo.sequence_order`,
      [assignmentId, userId],
    );
    return result.rows;
  }

  async findModuleProgression(
    userId: number,
    assignmentId: number,
  ): Promise<ModuleProgressionRow | undefined> {
    const result = await this.database.query<ModuleProgressionRow>(
      `SELECT
        (SELECT COUNT(*)::int FROM scenarios s
          WHERE s.training_module_id = a.training_module_id AND s.is_active)
          AS "activeScenarioCount",
        (SELECT COUNT(*)::int FROM scenario_attempts sa
          JOIN scenarios s ON s.id = sa.scenario_id AND s.is_active
          WHERE sa.training_assignment_id = a.id
            AND sa.completed_at IS NOT NULL) AS "completedScenarioCount",
        EXISTS (SELECT 1 FROM scenario_attempts sa
          JOIN scenarios s ON s.id = sa.scenario_id AND s.is_active
          WHERE sa.training_assignment_id = a.id) AS "scenarioStarted",
        EXISTS (SELECT 1 FROM assessments assessment
          WHERE assessment.training_module_id = a.training_module_id
            AND assessment.is_active) AS "hasAssessment",
        NOT EXISTS (SELECT 1 FROM assessments assessment
          WHERE assessment.training_module_id = a.training_module_id
            AND assessment.is_active
            AND NOT EXISTS (SELECT 1 FROM assessment_attempts attempt
              WHERE attempt.training_assignment_id = a.id
                AND attempt.assessment_id = assessment.id
                AND attempt.submitted_at IS NOT NULL AND attempt.passed))
          AS "assessmentPassed"
      FROM training_assignments a
      JOIN training_modules m ON m.id = a.training_module_id
      WHERE a.id = $1 AND a.trainee_id = $2 AND a.status = 'active'
        AND m.is_active`,
      [assignmentId, userId],
    );
    return result.rows[0];
  }

  async touchProgress(userId: number, assignmentId: number): Promise<void> {
    await this.database.query(
      `UPDATE progress p
      SET started_at = COALESCE(p.started_at, clock_timestamp()),
          last_accessed_at = clock_timestamp(),
          updated_at = clock_timestamp()
      FROM training_assignments a
      WHERE a.id = p.training_assignment_id AND a.id = $1 AND a.trainee_id = $2
        AND a.status = 'active'`,
      [assignmentId, userId],
    );
  }

  async completeContent(
    userId: number,
    assignmentId: number,
    contentId: number,
  ): Promise<boolean> {
    const result = await this.database.query(
      `INSERT INTO training_content_completion
        (trainee_id, training_assignment_id, training_module_id, training_content_id)
      SELECT a.trainee_id, a.id, a.training_module_id, c.id
      FROM training_assignments a
      JOIN training_content c ON c.training_module_id = a.training_module_id
      WHERE a.id = $1 AND a.trainee_id = $2 AND a.status = 'active'
        AND c.id = $3 AND c.is_active
        AND NOT EXISTS (
          SELECT 1 FROM formative_questions fq
          WHERE fq.training_content_id = c.id
            AND NOT EXISTS (
              SELECT 1 FROM formative_responses fr
              WHERE fr.training_assignment_id = a.id
                AND fr.formative_question_id = fq.id
                AND fr.is_correct
            )
        )
      ON CONFLICT (training_assignment_id, training_content_id) DO NOTHING`,
      [assignmentId, userId, contentId],
    );
    return result.rowCount === 1;
  }

  async submitFormativeAnswer(
    userId: number,
    assignmentId: number,
    contentId: number,
    questionId: number,
    optionId: number,
  ): Promise<{ correct: boolean } | undefined> {
    const result = await this.database.query<{ correct: boolean }>(
      `INSERT INTO formative_responses
        (trainee_id, training_assignment_id, training_module_id,
         training_content_id, formative_question_id, selected_option_id, is_correct)
      SELECT a.trainee_id, a.id, a.training_module_id, c.id, fq.id, fo.id, fo.is_correct
      FROM training_assignments a
      JOIN training_content c ON c.training_module_id = a.training_module_id
      JOIN formative_questions fq ON fq.training_content_id = c.id
      JOIN formative_answer_options fo ON fo.formative_question_id = fq.id
      WHERE a.id = $1 AND a.trainee_id = $2 AND a.status = 'active'
        AND c.id = $3 AND fq.id = $4 AND fo.id = $5
      ON CONFLICT (training_assignment_id, formative_question_id) DO UPDATE SET
        selected_option_id = EXCLUDED.selected_option_id,
        is_correct = EXCLUDED.is_correct,
        answered_at = clock_timestamp()
      RETURNING is_correct AS correct`,
      [assignmentId, userId, contentId, questionId, optionId],
    );
    return result.rows[0];
  }

  async refreshProgress(userId: number, assignmentId: number): Promise<void> {
    await this.database.query(
      `WITH stage AS (
        SELECT ta.id,
          COUNT(DISTINCT c.id)::numeric AS section_total,
          COUNT(DISTINCT cc.training_content_id)::numeric AS section_complete,
          CASE WHEN EXISTS (SELECT 1 FROM scenarios s WHERE s.training_module_id=ta.training_module_id AND s.is_active) THEN 1 ELSE 0 END AS has_scenario,
          CASE WHEN EXISTS (SELECT 1 FROM assessments a WHERE a.training_module_id=ta.training_module_id AND a.is_active) THEN 1 ELSE 0 END AS has_assessment
        FROM training_assignments ta
        LEFT JOIN training_content c ON c.training_module_id=ta.training_module_id AND c.is_active
        LEFT JOIN training_content_completion cc ON cc.training_assignment_id=ta.id AND cc.training_content_id=c.id
        WHERE ta.id=$1 AND ta.trainee_id=$2 AND ta.status='active'
        GROUP BY ta.id, ta.training_module_id
      )
      UPDATE progress p SET
        percentage = GREATEST(p.percentage, ROUND(100 * (stage.section_complete / NULLIF(stage.section_total, 0)) / (1 + stage.has_scenario + stage.has_assessment))),
        started_at = COALESCE(p.started_at, clock_timestamp()),
        last_accessed_at = clock_timestamp(), updated_at = clock_timestamp()
      FROM stage WHERE p.training_assignment_id=stage.id AND p.percentage < 100`,
      [assignmentId, userId],
    );
  }
}
