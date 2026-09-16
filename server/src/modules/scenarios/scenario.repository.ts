import type { Pool } from 'pg';

interface ScenarioContextRow {
  assignmentId: number;
  moduleId: number;
  scenarioId: number;
  title: string;
  description: string;
  resourceReference: string;
  sequenceOrder: number;
  activeSectionCount: number;
  completedSectionCount: number;
}

interface ScenarioAttemptRow {
  id: number;
  startedAt: Date;
  completedAt: Date | null;
}

interface ScenarioHazardRow {
  id: number;
  title: string;
  description: string;
  feedback: string;
  hotspotYaw: string;
  hotspotPitch: string;
  sequenceOrder: number;
  metadata: unknown;
  selectedDecisionKey: string | null;
  answeredCorrectly: boolean;
}

export class ScenarioRepository {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async findScenarioContext(
    userId: number,
    assignmentId: number,
  ): Promise<ScenarioContextRow | undefined> {
    const result = await this.database.query<ScenarioContextRow>(
      `SELECT a.id AS "assignmentId", a.training_module_id AS "moduleId",
        s.id AS "scenarioId", s.title, s.description,
        s.resource_reference AS "resourceReference",
        s.sequence_order AS "sequenceOrder",
        COUNT(DISTINCT c.id)::int AS "activeSectionCount",
        COUNT(DISTINCT cc.training_content_id)::int AS "completedSectionCount"
      FROM training_assignments a
      JOIN training_modules m ON m.id = a.training_module_id
      JOIN scenarios s ON s.training_module_id = m.id AND s.is_active
      LEFT JOIN training_content c
        ON c.training_module_id = m.id AND c.is_active
      LEFT JOIN training_content_completion cc
        ON cc.training_assignment_id = a.id AND cc.training_content_id = c.id
      WHERE a.id = $1 AND a.trainee_id = $2 AND a.status = 'active'
        AND m.slug = 'manual-handling'
      GROUP BY a.id, a.training_module_id, s.id, s.title, s.description,
        s.resource_reference, s.sequence_order
      ORDER BY s.sequence_order ASC
      LIMIT 1`,
      [assignmentId, userId],
    );
    return result.rows[0];
  }

  async ensureAttempt(
    userId: number,
    assignmentId: number,
    scenarioId: number,
  ): Promise<ScenarioAttemptRow | undefined> {
    const result = await this.database.query<ScenarioAttemptRow>(
      `INSERT INTO scenario_attempts
        (trainee_id, training_assignment_id, training_module_id, scenario_id)
      SELECT a.trainee_id, a.id, a.training_module_id, s.id
      FROM training_assignments a
      JOIN scenarios s ON s.training_module_id = a.training_module_id
      WHERE a.id = $1 AND a.trainee_id = $2 AND a.status = 'active'
        AND s.id = $3 AND s.is_active
      ON CONFLICT (training_assignment_id, scenario_id) DO UPDATE SET
        scenario_id = EXCLUDED.scenario_id
      RETURNING id, started_at AS "startedAt", completed_at AS "completedAt"`,
      [assignmentId, userId, scenarioId],
    );
    return result.rows[0];
  }

  async findHazards(
    attemptId: number,
    scenarioId: number,
  ): Promise<ScenarioHazardRow[]> {
    const result = await this.database.query<ScenarioHazardRow>(
      `SELECT h.id, h.title, h.description, h.feedback,
        h.hotspot_yaw::text AS "hotspotYaw",
        h.hotspot_pitch::text AS "hotspotPitch",
        h.sequence_order AS "sequenceOrder", h.metadata,
        shr.selected_decision_key AS "selectedDecisionKey",
        COALESCE(shr.is_correct, false) AS "answeredCorrectly"
      FROM hazards h
      LEFT JOIN scenario_hazard_responses shr
        ON shr.scenario_attempt_id = $1 AND shr.hazard_id = h.id
      WHERE h.scenario_id = $2
      ORDER BY h.sequence_order ASC, h.id ASC`,
      [attemptId, scenarioId],
    );
    return result.rows;
  }

  async submitHazardDecision(
    attemptId: number,
    scenarioId: number,
    hazardId: number,
    decisionKey: string,
  ): Promise<{ correct: boolean; feedback: string } | undefined> {
    const result = await this.database.query<{
      correct: boolean;
      feedback: string;
    }>(
      `INSERT INTO scenario_hazard_responses
        (scenario_attempt_id, scenario_id, hazard_id, selected_decision_key, is_correct)
      SELECT $1, h.scenario_id, h.id, $4,
        (h.metadata->>'correctDecisionKey') = $4
      FROM hazards h
      WHERE h.id = $3 AND h.scenario_id = $2
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(h.metadata->'decisionOptions', '[]'::jsonb)) option
          WHERE option->>'key' = $4
        )
      ON CONFLICT (scenario_attempt_id, hazard_id) DO UPDATE SET
        selected_decision_key = CASE
          WHEN scenario_hazard_responses.is_correct
            THEN scenario_hazard_responses.selected_decision_key
          ELSE EXCLUDED.selected_decision_key
        END,
        is_correct = scenario_hazard_responses.is_correct OR EXCLUDED.is_correct,
        answered_at = clock_timestamp()
      RETURNING is_correct AS correct,
        (SELECT feedback FROM hazards WHERE id = $3) AS feedback`,
      [attemptId, scenarioId, hazardId, decisionKey],
    );
    return result.rows[0];
  }

  async completeAttemptIfReady(
    attemptId: number,
    scenarioId: number,
  ): Promise<void> {
    await this.database.query(
      `UPDATE scenario_attempts sa
      SET completed_at = COALESCE(sa.completed_at, clock_timestamp())
      WHERE sa.id = $1 AND sa.scenario_id = $2
        AND EXISTS (SELECT 1 FROM hazards h WHERE h.scenario_id = sa.scenario_id)
        AND NOT EXISTS (
          SELECT 1 FROM hazards h
          WHERE h.scenario_id = sa.scenario_id
            AND NOT EXISTS (
              SELECT 1 FROM scenario_hazard_responses shr
              WHERE shr.scenario_attempt_id = sa.id
                AND shr.hazard_id = h.id
                AND shr.is_correct
            )
        )`,
      [attemptId, scenarioId],
    );
  }

  async findAttempt(
    attemptId: number,
    scenarioId: number,
  ): Promise<ScenarioAttemptRow | undefined> {
    const result = await this.database.query<ScenarioAttemptRow>(
      `SELECT id, started_at AS "startedAt", completed_at AS "completedAt"
      FROM scenario_attempts WHERE id = $1 AND scenario_id = $2`,
      [attemptId, scenarioId],
    );
    return result.rows[0];
  }
}
