CREATE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['system_roles', 'job_roles', 'users', 'training_modules',
    'training_assignments', 'training_content', 'scenarios', 'hazards', 'assessments',
    'questions', 'answer_options', 'assessment_responses', 'progress']
  LOOP
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', table_name);
  END LOOP;
END;
$$;

CREATE FUNCTION protect_system_role_name() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION 'System role names are stable permission identifiers' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_system_role_name BEFORE UPDATE ON system_roles
FOR EACH ROW EXECUTE FUNCTION protect_system_role_name();

CREATE FUNCTION validate_user_role() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE role_name text;
BEGIN
  SELECT name INTO role_name FROM system_roles WHERE id = NEW.system_role_id;
  IF role_name = 'administrator' AND NEW.job_role_id IS NOT NULL THEN
    RAISE EXCEPTION 'Job roles belong to trainees, not administrators' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.system_role_id IS DISTINCT FROM OLD.system_role_id THEN
    IF EXISTS (SELECT 1 FROM training_assignments WHERE trainee_id = OLD.id OR assigned_by = OLD.id)
      OR EXISTS (SELECT 1 FROM certificates WHERE trainee_id = OLD.id) THEN
      RAISE EXCEPTION 'Cannot change the system role of a user with training history' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_user_role BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION validate_user_role();

CREATE FUNCTION validate_assignment_roles() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  -- Locks prevent a simultaneous role change from invalidating this check.
  PERFORM id FROM users WHERE id IN (NEW.trainee_id, NEW.assigned_by) ORDER BY id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM users u JOIN system_roles r ON r.id = u.system_role_id
    WHERE u.id = NEW.trainee_id AND r.name = 'trainee') THEN
    RAISE EXCEPTION 'Assignment recipient must be a trainee' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users u JOIN system_roles r ON r.id = u.system_role_id
    WHERE u.id = NEW.assigned_by AND r.name = 'administrator') THEN
    RAISE EXCEPTION 'Assignment creator must be an administrator' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.trainee_id, NEW.training_module_id, NEW.assigned_by, NEW.assigned_at)
    IS DISTINCT FROM (OLD.trainee_id, OLD.training_module_id, OLD.assigned_by, OLD.assigned_at) THEN
    RAISE EXCEPTION 'Assignment identity and original attribution are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_assignment_roles BEFORE INSERT OR UPDATE ON training_assignments
FOR EACH ROW EXECUTE FUNCTION validate_assignment_roles();

CREATE FUNCTION protect_attempt_result() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.submitted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Submitted attempts are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT pass_percentage INTO NEW.pass_percentage_snapshot FROM assessments WHERE id = NEW.assessment_id;
  ELSE
    IF OLD.submitted_at IS NOT NULL OR
      (NEW.trainee_id, NEW.training_assignment_id, NEW.training_module_id, NEW.assessment_id,
       NEW.started_at, NEW.attempt_number, NEW.pass_percentage_snapshot)
      IS DISTINCT FROM
      (OLD.trainee_id, OLD.training_assignment_id, OLD.training_module_id, OLD.assessment_id,
       OLD.started_at, OLD.attempt_number, OLD.pass_percentage_snapshot) THEN
      RAISE EXCEPTION 'Submitted results and attempt identity are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_attempt_result BEFORE INSERT OR UPDATE OR DELETE ON assessment_attempts
FOR EACH ROW EXECUTE FUNCTION protect_attempt_result();

CREATE FUNCTION validate_response() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE submitted timestamptz; kind text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT submitted_at INTO submitted FROM assessment_attempts WHERE id = OLD.assessment_attempt_id FOR SHARE;
    IF submitted IS NOT NULL THEN
      RAISE EXCEPTION 'Responses to submitted attempts are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT submitted_at INTO submitted FROM assessment_attempts WHERE id = NEW.assessment_attempt_id FOR SHARE;
  IF submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Responses to submitted attempts are immutable' USING ERRCODE = '23514';
  END IF;
  SELECT question_type INTO kind FROM questions WHERE id = NEW.question_id;
  IF (kind = 'free_text' AND NEW.selected_answer_option_id IS NOT NULL)
    OR (kind IN ('single_choice', 'true_false') AND NEW.response_text IS NOT NULL) THEN
    RAISE EXCEPTION 'Response format does not match the question type' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_response BEFORE INSERT OR UPDATE OR DELETE ON assessment_responses
FOR EACH ROW EXECUTE FUNCTION validate_response();
