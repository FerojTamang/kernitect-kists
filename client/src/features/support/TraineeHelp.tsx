import { Link } from 'react-router-dom';
import './support.css';

const faqCategories = [
  {
    title: 'General',
    questions: [
      [
        'What is KISTS?',
        'KISTS is Kernitect’s web-based safety training system for warehousing and logistics.',
      ],
      [
        'Who can use KISTS?',
        'Trainees use KISTS to complete assigned learning, scenarios and assessments. Administrators manage training and monitor results.',
      ],
      [
        'Where can I see my assigned training?',
        'Open My Training from the trainee navigation to see every module currently assigned to you.',
      ],
    ],
  },
  {
    title: 'Training & Learning',
    questions: [
      [
        'How do I start assigned training?',
        'Open My Training and select Start or Continue on the relevant module.',
      ],
      [
        'Can I resume training later?',
        'Yes. KISTS records completed learning sections so you can continue from your latest available step.',
      ],
      [
        'Why is a training module locked?',
        'Later activities remain unavailable until their required earlier learning steps are complete.',
      ],
    ],
  },
  {
    title: '360° Scenario',
    questions: [
      [
        'How do I use the 360° warehouse scenario?',
        'Drag to look around the warehouse and select the marked safety points to review each decision.',
      ],
      [
        'Why can I not access the scenario yet?',
        'Complete the module’s required learning content before opening its interactive scenario.',
      ],
      [
        'What happens if I choose an incorrect safety decision?',
        'KISTS provides feedback so you can review the hazard and choose a safer action.',
      ],
    ],
  },
  {
    title: 'Assessments',
    questions: [
      [
        'When does the final assessment become available?',
        'The final assessment becomes available after the module’s required learning and scenario stages are complete.',
      ],
      [
        'What happens if I fail an assessment?',
        'Your result is recorded and the result screen explains the next available action.',
      ],
      [
        'Can I retry an assessment?',
        'Yes, when a retry is available you can review the module and start another attempt.',
      ],
    ],
  },
  {
    title: 'Certificates',
    questions: [
      [
        'When is my certificate issued?',
        'A certificate is issued after all currently required training and assessment conditions are complete.',
      ],
      [
        'Why is my certificate not available yet?',
        'Check My Progress for an incomplete required learning, scenario or assessment stage.',
      ],
      [
        'Where can I view my certificate?',
        'Open Certificates from the trainee navigation to view your current certificate and history.',
      ],
    ],
  },
  {
    title: 'Account & Login',
    questions: [
      [
        'What should I do if I cannot log in?',
        'Check your email and password, then contact an administrator if you still cannot access KISTS.',
      ],
      [
        'Why is my account disabled?',
        'An administrator may have disabled access. Contact your administrator for help with account status.',
      ],
    ],
  },
  {
    title: 'Technical Support',
    questions: [
      [
        'What should I do if a page does not load correctly?',
        'Refresh the page once and check your connection. If the problem continues, send a Technical issue message.',
      ],
      [
        'How do I contact an administrator?',
        'Use Contact Administrator below and describe the issue clearly.',
      ],
    ],
  },
] as const;

export function TraineeHelp() {
  return (
    <div className="trainee-help-page">
      <header className="support-page-header">
        <p className="eyebrow">Help &amp; support</p>
        <h1>How can we help?</h1>
        <p>
          Find verified KISTS guidance or send a message to an administrator.
        </p>
      </header>

      <nav className="help-options" aria-label="Help options">
        <a href="#frequently-asked-questions">
          <strong>View Help &amp; FAQ</strong>
          <span>Browse guidance for using KISTS.</span>
        </a>
        <Link to="/trainee/support">
          <strong>Contact Administrator</strong>
          <span>Send a secure support message.</span>
        </Link>
        <Link to="/trainee/help/ai-assistant">
          <strong>Ask AI Assistant</strong>
          <span>Future development information.</span>
        </Link>
      </nav>

      <section
        id="frequently-asked-questions"
        className="faq-panel"
        aria-labelledby="faq-heading"
      >
        <div className="support-section-heading">
          <p>Controlled guidance</p>
          <h2 id="faq-heading">Frequently asked questions</h2>
        </div>
        <div className="faq-categories">
          {faqCategories.map((category) => (
            <section key={category.title} className="faq-category">
              <h3>{category.title}</h3>
              {category.questions.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
