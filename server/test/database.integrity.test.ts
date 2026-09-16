import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isolated,
  rejectsSql,
  fixture,
  assign,
  complete,
  attempt,
} from './helpers/database.js';

test('duplicate email is rejected case-insensitively', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    await rejectsSql(
      client,
      `INSERT INTO users (system_role_id, first_name, last_name, email, password_hash)
    SELECT system_role_id, first_name, last_name, upper(email), password_hash FROM users WHERE id = $1`,
      [f.trainee],
      '23505',
    );
  }));

test('missing system and job role references are rejected', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    await rejectsSql(
      client,
      'UPDATE users SET system_role_id = 2147483647 WHERE id = $1',
      [f.trainee],
      '23503',
    );
    await rejectsSql(
      client,
      'UPDATE users SET job_role_id = 2147483647 WHERE id = $1',
      [f.trainee],
      '23503',
    );
  }));

test('administrators cannot carry trainee job roles; trainees may await job allocation', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    await rejectsSql(
      client,
      'UPDATE users SET job_role_id = (SELECT job_role_id FROM users WHERE id = $1) WHERE id = $2',
      [f.trainee, f.admin],
      '23514',
    );
    await client.query('UPDATE users SET job_role_id = NULL WHERE id = $1', [
      f.trainee,
    ]);
  }));

test('permission role names cannot be renamed beneath existing users', async () =>
  isolated(async (client) => {
    await rejectsSql(
      client,
      "UPDATE system_roles SET name = 'administrator' WHERE name = 'trainee'",
      [],
      '23514',
    );
  }));

test('assignment recipient and assigner system roles are enforced', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    await rejectsSql(
      client,
      'INSERT INTO training_assignments (trainee_id, training_module_id, assigned_by) VALUES ($1, $2, $3)',
      [f.admin, f.manual, f.admin],
      '23514',
    );
    await rejectsSql(
      client,
      'INSERT INTO training_assignments (trainee_id, training_module_id, assigned_by) VALUES ($1, $2, $3)',
      [f.trainee, f.manual, f.trainee],
      '23514',
    );
  }));

test('users with assignment history cannot change permission role', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    await assign(client, f.trainee, f.manual, f.admin);
    await rejectsSql(
      client,
      "UPDATE users SET system_role_id = (SELECT id FROM system_roles WHERE name = 'administrator'), job_role_id = NULL WHERE id = $1",
      [f.trainee],
      '23514',
    );
  }));

test('duplicate trainee/module assignments and nonexistent modules are rejected', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    await assign(client, f.trainee, f.manual, f.admin);
    await rejectsSql(
      client,
      'INSERT INTO training_assignments (trainee_id, training_module_id, assigned_by) VALUES ($1, $2, $3)',
      [f.trainee, f.manual, f.admin],
      '23505',
    );
    await rejectsSql(
      client,
      'INSERT INTO training_assignments (trainee_id, training_module_id, assigned_by) VALUES ($1, $2, $3)',
      [f.trainee, 2147483647, f.admin],
      '23503',
    );
  }));

test('one module supports multiple scenarios and assessments', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    await client.query(
      "INSERT INTO scenarios (training_module_id, title, sequence_order) VALUES ($1, 'TEST: Second scene', 2)",
      [f.manual],
    );
    await client.query(
      "INSERT INTO assessments (training_module_id, title, pass_percentage, sequence_order) VALUES ($1, 'TEST: Second assessment', 60, 2)",
      [f.manual],
    );
    assert.equal(
      (
        await client.query(
          'SELECT id FROM scenarios WHERE training_module_id = $1',
          [f.manual],
        )
      ).rowCount,
      2,
    );
    assert.equal(
      (
        await client.query(
          'SELECT id FROM assessments WHERE training_module_id = $1',
          [f.manual],
        )
      ).rowCount,
      2,
    );
  }));

test('progress cannot point to another trainee or module and completion must be coherent', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const assignment = await assign(client, f.trainee, f.manual, f.admin);
    await rejectsSql(
      client,
      'INSERT INTO progress (trainee_id, training_module_id, training_assignment_id) VALUES ($1, $2, $3)',
      [f.admin, f.manual, assignment],
      '23503',
    );
    await rejectsSql(
      client,
      'INSERT INTO progress (trainee_id, training_module_id, training_assignment_id) VALUES ($1, $2, $3)',
      [f.trainee, f.forklift, assignment],
      '23503',
    );
    await rejectsSql(
      client,
      'INSERT INTO progress (trainee_id, training_module_id, training_assignment_id, percentage) VALUES ($1, $2, $3, 100)',
      [f.trainee, f.manual, assignment],
      '23514',
    );
    await complete(client, assignment);
    await rejectsSql(
      client,
      'INSERT INTO progress (trainee_id, training_module_id, training_assignment_id) VALUES ($1, $2, $3)',
      [f.trainee, f.manual, assignment],
      '23505',
    );
  }));

test('attempts must use an assessment from the assigned module', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const assignment = await assign(client, f.trainee, f.forklift, f.admin);
    await rejectsSql(
      client,
      `INSERT INTO assessment_attempts (trainee_id, training_assignment_id, training_module_id, assessment_id, attempt_number)
    VALUES ($1, $2, $3, $4, 1)`,
      [f.trainee, assignment, f.forklift, f.assessment],
      '23503',
    );
  }));

test('attempt thresholds are snapshots, passed is derived, and submitted results are immutable', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const assignment = await assign(client, f.trainee, f.manual, f.admin);
    const id = await attempt(client, assignment, f.assessment, 75);
    await client.query(
      'UPDATE assessments SET pass_percentage = 90 WHERE id = $1',
      [f.assessment],
    );
    const result = (
      await client.query(
        'SELECT passed, pass_percentage_snapshot FROM assessment_attempts WHERE id = $1',
        [id],
      )
    ).rows[0];
    assert.equal(result.passed, true);
    assert.equal(Number(result.pass_percentage_snapshot), 75);
    await rejectsSql(
      client,
      'UPDATE assessment_attempts SET score_percentage = 100 WHERE id = $1',
      [id],
      '23514',
    );
    await rejectsSql(
      client,
      'DELETE FROM assessment_attempts WHERE id = $1',
      [id],
      '23514',
    );
    const next = await attempt(client, assignment, f.assessment, 75, 2);
    assert.equal(
      (
        await client.query(
          'SELECT passed FROM assessment_attempts WHERE id = $1',
          [next],
        )
      ).rows[0].passed,
      false,
    );
  }));

test('responses enforce attempt/assessment/question/option membership', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const assignment = await assign(client, f.trainee, f.manual, f.admin);
    const id = await attempt(client, assignment, f.assessment);
    const original = (
      await client.query<{ id: number }>(
        'SELECT id FROM questions WHERE assessment_id = $1',
        [f.assessment],
      )
    ).rows[0]!.id;
    const otherAssessment = (
      await client.query<{ id: number }>(
        "INSERT INTO assessments (training_module_id, title, pass_percentage, sequence_order) VALUES ($1, 'TEST', 50, 2) RETURNING id",
        [f.manual],
      )
    ).rows[0]!.id;
    const otherQuestion = (
      await client.query<{ id: number }>(
        "INSERT INTO questions (assessment_id, question_text, question_type, sequence_order) VALUES ($1, 'TEST?', 'single_choice', 1) RETURNING id",
        [otherAssessment],
      )
    ).rows[0]!.id;
    const otherOption = (
      await client.query<{ id: number }>(
        "INSERT INTO answer_options (question_id, option_text, sequence_order) VALUES ($1, 'TEST', 1) RETURNING id",
        [otherQuestion],
      )
    ).rows[0]!.id;
    await rejectsSql(
      client,
      'INSERT INTO assessment_responses (assessment_attempt_id, assessment_id, question_id) VALUES ($1, $2, $3)',
      [id, f.assessment, otherQuestion],
      '23503',
    );
    await rejectsSql(
      client,
      'INSERT INTO assessment_responses (assessment_attempt_id, assessment_id, question_id) VALUES ($1, $2, $3)',
      [id, otherAssessment, otherQuestion],
      '23503',
    );
    await rejectsSql(
      client,
      'INSERT INTO assessment_responses (assessment_attempt_id, assessment_id, question_id, selected_answer_option_id) VALUES ($1, $2, $3, $4)',
      [id, f.assessment, original, otherOption],
      '23503',
    );
  }));

test('recorded responses become immutable when their attempt is submitted', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const assignment = await assign(client, f.trainee, f.manual, f.admin);
    const id = await attempt(client, assignment, f.assessment);
    await client.query(
      `INSERT INTO assessment_responses (assessment_attempt_id, assessment_id, question_id, selected_answer_option_id, is_correct)
    SELECT $1, q.assessment_id, q.id, o.id, true FROM questions q JOIN answer_options o ON o.question_id = q.id
    WHERE q.assessment_id = $2 AND o.is_correct`,
      [id, f.assessment],
    );
    await client.query(
      'UPDATE assessment_attempts SET submitted_at = now(), score_percentage = 100 WHERE id = $1',
      [id],
    );
    await rejectsSql(
      client,
      'UPDATE assessment_responses SET is_correct = false WHERE assessment_attempt_id = $1',
      [id],
      '23514',
    );
  }));
