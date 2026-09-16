# Manual Handling Learning Module

## Phase 5 scope

Phase 5 provides the protected, database-backed Manual Handling learning journey. It includes five learning sections, two formative Check Your Understanding questions per section, persistent answers, retry feedback, section completion and resume behavior.

It does not implement the Phase 6 interactive 360-degree scenario, scenario scoring, the Phase 7 final graded assessment, certificate issuance or administrator content-management workflows.

**100% learning progress does not equal final module completion.** The assignment remains `in_progress` until later scenario and assessment phases exist.

## Frontend routes

- `/trainee/training` - authenticated trainee-specific assigned module list.
- `/trainee/training/:assignmentId` - overview, ordered section list, learning content, formative checks and the final learning-content state.
- `/trainee/dashboard` - existing dashboard entry point. The Manual Handling card shows persisted learning progress and section count.

The route remains inside the protected trainee shell, with My Training active. The module list reuses the trainee dashboard assignment contract, so it shows only modules assigned to the authenticated trainee. Forklift & Pedestrian Safety is shown honestly as not started/content coming later; no fake forklift lesson is added.

## API endpoints

- `GET /api/trainee/training/:assignmentId` returns the assigned Manual Handling module, five active sections, formative questions/options, persisted answer state, learning progress and the first incomplete section.
- `POST /api/trainee/training/:assignmentId/content/:contentId/questions/:questionId/answer` records a selected formative option and returns correctness, retry feedback, section-completion state and the refreshed module.
- `POST /api/trainee/training/:assignmentId/content/:contentId/complete` remains assignment-bound but rejects with `409` until both formative questions for the section are correct. Repeated eligible calls are idempotent.

All endpoints require an authenticated trainee. Assignment ownership, Manual Handling module ownership, section/question ownership and option ownership are checked server-side. Malformed IDs return `400`; unavailable or cross-trainee resources return `404`.

## Persistence model

Migration `006_training_content_completion.sql` stores completed sections in `training_content_completion`, tied to trainee, assignment, module and content with composite foreign keys. Its primary key makes completion idempotent.

Migration `007_manual_handling_content.sql` established the original learning content. Migration `008_formative_checks.sql` adds the fifth section and formative tables. Migrations `009_formative_question_seed.sql` and `010_formative_question_content_fk.sql` preserve the migration history and correct the formative question ownership constraint. Development seed data inserts the question definitions and options after migrations create the tables.

Formative checks intentionally do not reuse `assessments`, `questions`, `answer_options`, `assessment_attempts` or `assessment_responses`. Those tables retain their Phase 7 graded-assessment meaning. The formative model consists of:

- `formative_questions` - two questions per active learning section.
- `formative_answer_options` - exactly four options per question, with one correct option in development data.
- `formative_responses` - the trainee’s latest selected option and correctness, tied to the assignment, module, section and question.

Wrong answers are persisted safely and can be replaced by a later retry. Correct answers persist across refresh and re-login. No response creates an assessment attempt, score, pass/fail result or certificate evidence.

The existing `progress` table remains the aggregate assignment record. Opening training updates access/start timestamps only. Learning completion does not set assignment percentage to 100 and does not mark the assignment complete.

## Five learning sections

1. **Introduction to Manual Handling** - what manual handling includes and why safe handling matters.
2. **Risks and Injuries** - back pain, muscle strain, joint injury and musculoskeletal injury, with a warning panel.
3. **Assessing the Task and Load** - size, shape, stability, weight, route, obstacles, destination, assistance, equipment and individual capability.
4. **Safe Lifting Techniques** - planning, stable posture, knees, grip, keeping the load close, smooth lifting, avoiding twisting and asking for help or using equipment.
5. **Practical Examples** - safe and unsafe warehouse handling choices.

Each section has two concise, single-answer multiple-choice practice questions and exactly four answer options per question.

## Training imagery

The learning UI uses the supplied assets from `client/src/assets/training/manual-handling/`:

- `manual-handling-hero.png` for the module overview and Introduction.
- `manual-handling-injury-risk.png` for Risks and Injuries.
- `assess-load-before-lifting.png` for Assessing the Task and Load.
- `correct-lifting-posture.png` and `incorrect-lifting-posture.png` for the Safe Lifting Techniques DO/DON'T comparison.
- `safe-handling-equipment.png` for Practical Examples.

The lifting comparison teaches safer and unsafe choices without claiming that one posture eliminates all injury risk.

## Formative behavior

The trainee must open the section content and answer both questions correctly. Opening a page alone never completes a section. Selecting an option is separate from submission: the selected option remains visible and only `Check Answer` sends the response to the API. A wrong answer shows negative feedback on the current question and leaves it retryable. A correct answer shows positive feedback and persists the correct state. Once both questions are correct, the section completion row is written and the learning progress updates immediately. The UI stays on the current section until the trainee clicks the explicit Continue action.

The UI shows `X of 5 sections completed` and `Y% learning progress`, with an accessible progress bar. It clearly distinguishes Completed, In progress and Not started sections without relying only on color.

## Progress and resume

Learning progress is calculated dynamically from persisted active-section state:

`learningProgressPercentage = (completed learning sections / total active learning sections) * 100`

With five active sections the progression is 0%, 20%, 40%, 60%, 80% and 100%. The implementation does not hard-code those values and continues to work if the active section count changes.

Resume selects the first incomplete ordered section. With no completions it opens Introduction. After two completed sections it opens Assessing the Task and Load. After all five sections and checks are complete, the UI shows **Learning content complete** and:

- You have completed all Manual Handling learning sections and knowledge checks.
- Next stage: Interactive Warehouse Safety Scenario.
- Coming next.

The final state offers Return to Dashboard. It does not say Module Complete and does not show certificates, assessment scores or pass/fail results.

## Development reset

`npm.cmd run auth:demo` restores Alex Morgan’s local account and active assignments, sets the Manual Handling aggregate demo progress to its development value, and clears only Alex’s Manual Handling `training_content_completion` and `formative_responses` rows. It does not run `db:reset` or destroy unrelated development records.

## Later phases and limitations

The next stage is the Phase 6 interactive warehouse safety scenario. The current UI only presents it as upcoming. No 360 viewer, hazard interaction, scenario score, final graded assessment, assessment attempt, certificate or final module-completion rule is implemented here. Phase 7 will use the existing graded `assessments`, `questions`, `answer_options`, `assessment_attempts` and `assessment_responses` model separately.
