import { Link } from 'react-router-dom';
import './support.css';

export function TraineeAiAssistant() {
  return (
    <div className="trainee-support-page">
      <section className="ai-coming-soon">
        <span aria-hidden="true">AI</span>
        <p className="eyebrow">Future development</p>
        <h1>AI Assistant — Coming Soon</h1>
        <p>
          AI-assisted KISTS guidance is planned as a future development. The
          current prototype provides verified FAQ guidance and direct
          administrator support.
        </p>
        <div>
          <Link to="/trainee/help">View Help &amp; FAQ</Link>
          <Link to="/trainee/support">Contact Administrator</Link>
        </div>
      </section>
    </div>
  );
}
