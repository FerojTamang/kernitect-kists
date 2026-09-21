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
import { CertificateIssuanceService } from '../src/modules/certificates/certificate-issuance.service.js';

test('shared issuance rechecks eligibility after a requirement is removed and remains idempotent', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const manual = await assign(client, f.trainee, f.manual, f.admin);
    const forklift = await assign(client, f.trainee, f.forklift, f.admin);
    await complete(client, manual);
    await attempt(client, manual, f.assessment, 100);
    const issuance = new CertificateIssuanceService(client);

    await issuance.issueIfEligible(f.trainee);
    assert.equal(
      (
        await client.query('SELECT id FROM certificates WHERE trainee_id=$1', [
          f.trainee,
        ])
      ).rowCount,
      0,
    );

    await client.query(
      'UPDATE training_assignments SET required=false WHERE id=$1',
      [forklift],
    );
    await issuance.issueIfEligible(f.trainee);
    const issued = await client.query<{
      id: number;
      certificateNumber: string;
      issuedAt: Date;
    }>(
      `SELECT id, certificate_number AS "certificateNumber", issued_at AS "issuedAt"
       FROM certificates WHERE trainee_id=$1 AND status='issued'`,
      [f.trainee],
    );
    assert.equal(issued.rowCount, 1);

    await issuance.issueIfEligible(f.trainee);
    const unchanged = await client.query<{
      id: number;
      certificateNumber: string;
      issuedAt: Date;
    }>(
      `SELECT id, certificate_number AS "certificateNumber", issued_at AS "issuedAt"
       FROM certificates WHERE trainee_id=$1 AND status='issued'`,
      [f.trainee],
    );
    assert.deepEqual(unchanged.rows, issued.rows);
  }));

test('certification rejects no required assignments and incomplete required training', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    await rejectsSql(
      client,
      "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-NONE')",
      [f.trainee],
      '23514',
    );
    await assign(client, f.trainee, f.manual, f.admin);
    await rejectsSql(
      client,
      "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-INCOMPLETE')",
      [f.trainee],
      '23514',
    );
  }));

test('certification requires passing every active associated assessment', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const assignment = await assign(client, f.trainee, f.manual, f.admin);
    await complete(client, assignment);
    await client.query(
      'UPDATE assessments SET is_active = true WHERE id = $1',
      [f.assessment],
    );
    const second = (
      await client.query<{ id: number }>(
        "INSERT INTO assessments (training_module_id, title, pass_percentage, sequence_order, is_active) VALUES ($1, 'TEST: Second', 50, 3, true) RETURNING id",
        [f.manual],
      )
    ).rows[0]!.id;
    await attempt(client, assignment, f.assessment, 20);
    await rejectsSql(
      client,
      "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-FAILED')",
      [f.trainee],
      '23514',
    );
    await attempt(client, assignment, f.assessment, 100, 2);
    await rejectsSql(
      client,
      "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-MISSING')",
      [f.trainee],
      '23514',
    );
    await attempt(client, assignment, second, 100);
    await client.query(
      "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-PASSED')",
      [f.trainee],
    );
    assert.equal(
      (await client.query('SELECT * FROM certificate_assessment_attempts'))
        .rowCount,
      2,
    );
  }));

test('optional, cancelled and unassigned modules do not block certification', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const required = await assign(client, f.trainee, f.manual, f.admin);
    const optional = await assign(
      client,
      f.trainee,
      f.forklift,
      f.admin,
      false,
    );
    await complete(client, required);
    await attempt(client, required, f.assessment, 100);
    await client.query(
      "INSERT INTO training_modules (title, slug) VALUES ('TEST: Unassigned', 'test-unassigned')",
    );
    await client.query(
      "INSERT INTO assessments (training_module_id, title, pass_percentage, sequence_order, is_active) SELECT id, 'TEST', 100, 1, true FROM training_modules WHERE slug = 'test-unassigned'",
    );
    const cert = (
      await client.query<{ id: number }>(
        "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-OPTIONAL') RETURNING id",
        [f.trainee],
      )
    ).rows[0]!.id;
    assert.deepEqual(
      (
        await client.query(
          'SELECT training_assignment_id FROM certificate_assignments WHERE certificate_id = $1',
          [cert],
        )
      ).rows,
      [{ training_assignment_id: required }],
    );
    await client.query(
      `UPDATE training_assignments SET required = true, status = 'cancelled' WHERE id = $1`,
      [optional],
    );
    assert.equal(
      (
        await client.query<{ eligible: boolean }>(
          `SELECT eligible FROM certification_eligibility WHERE trainee_id = $1`,
          [f.trainee],
        )
      ).rows[0]!.eligible,
      true,
    );
    assert.equal(
      (
        await client.query(
          `SELECT id FROM available_certificates WHERE id = $1`,
          [cert],
        )
      ).rowCount,
      1,
    );
  }));

test('required incomplete assignments still block certification when their module is inactive', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const required = await assign(client, f.trainee, f.manual, f.admin);
    await complete(client, required);
    await assign(client, f.trainee, f.forklift, f.admin);
    await client.query(
      'UPDATE training_modules SET is_active = false WHERE id = $1',
      [f.forklift],
    );
    await rejectsSql(
      client,
      "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-INACTIVE-MODULE')",
      [f.trainee],
      '23514',
    );
  }));

test('certificates preserve issuance evidence when a new required assignment is added', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const required = await assign(client, f.trainee, f.manual, f.admin);
    await complete(client, required);
    await attempt(client, required, f.assessment, 100);
    const cert = (
      await client.query<{ id: number }>(
        "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-HISTORY') RETURNING id",
        [f.trainee],
      )
    ).rows[0]!.id;
    assert.equal(
      (
        await client.query(
          'SELECT id FROM available_certificates WHERE id = $1',
          [cert],
        )
      ).rowCount,
      1,
    );
    const addedRequirement = await assign(
      client,
      f.trainee,
      f.forklift,
      f.admin,
    );
    assert.equal(
      (
        await client.query(
          'SELECT eligible FROM certification_eligibility WHERE trainee_id = $1',
          [f.trainee],
        )
      ).rows[0].eligible,
      false,
    );
    assert.equal(
      (
        await client.query(
          'SELECT id FROM available_certificates WHERE id = $1',
          [cert],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await client.query(
          'SELECT * FROM certificate_assignments WHERE certificate_id = $1',
          [cert],
        )
      ).rowCount,
      1,
    );
    await complete(client, addedRequirement);
    const forkliftAssessment = (
      await client.query<{ id: number }>(
        'SELECT id FROM assessments WHERE training_module_id=$1 AND is_active',
        [f.forklift],
      )
    ).rows[0]!.id;
    await attempt(client, addedRequirement, forkliftAssessment, 100);
    assert.equal(
      (
        await client.query(
          'SELECT eligible FROM certification_eligibility WHERE trainee_id = $1',
          [f.trainee],
        )
      ).rows[0].eligible,
      true,
    );
    assert.equal(
      (
        await client.query(
          'SELECT id FROM available_certificates WHERE id = $1',
          [cert],
        )
      ).rowCount,
      0,
    );
    await rejectsSql(
      client,
      'DELETE FROM certificate_assignments WHERE certificate_id = $1',
      [cert],
      '23514',
    );
    await rejectsSql(
      client,
      'UPDATE certificates SET trainee_id = $1 WHERE id = $2',
      [f.admin, cert],
      '23514',
    );
  }));

test('certificate evidence cannot be inserted directly or rewritten', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const assignment = await assign(client, f.trainee, f.manual, f.admin);
    await complete(client, assignment);
    await attempt(client, assignment, f.assessment, 100);
    const cert = (
      await client.query<{ id: number }>(
        "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-EVIDENCE') RETURNING id",
        [f.trainee],
      )
    ).rows[0]!.id;
    await rejectsSql(
      client,
      'INSERT INTO certificate_assignments (certificate_id, training_assignment_id, completed_at_snapshot) VALUES ($1, $2, now())',
      [cert, assignment],
      '23514',
    );
    await rejectsSql(
      client,
      'UPDATE certificate_assignments SET completed_at_snapshot = now() WHERE certificate_id = $1',
      [cert],
      '23514',
    );
    await rejectsSql(
      client,
      'DELETE FROM training_assignments WHERE id = $1',
      [assignment],
      '23503',
    );
  }));

test('one certificate per trainee and requirement snapshot; revocation does not permit duplicate snapshot issuance', async () =>
  isolated(async (client) => {
    const f = await fixture(client);
    const assignment = await assign(client, f.trainee, f.manual, f.admin);
    await complete(client, assignment);
    await attempt(client, assignment, f.assessment, 100);
    const cert = (
      await client.query<{ id: number }>(
        "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-CURRENT') RETURNING id",
        [f.trainee],
      )
    ).rows[0]!.id;
    await rejectsSql(
      client,
      "INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-DUPLICATE')",
      [f.trainee],
      '23505',
    );
    await client.query(
      "UPDATE certificates SET status = 'revoked', revoked_at = clock_timestamp() WHERE id = $1",
      [cert],
    );
    await rejectsSql(
      client,
      "UPDATE certificates SET status = 'issued', revoked_at = NULL WHERE id = $1",
      [cert],
      '23514',
    );
    await rejectsSql(
      client,
      `INSERT INTO certificates (trainee_id, certificate_number) VALUES ($1, 'TEST-REISSUED')`,
      [f.trainee],
      '23505',
    );
  }));
