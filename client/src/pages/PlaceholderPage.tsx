interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <>
      <p className="eyebrow">KISTS / Workspace preview</p>
      <h1>{title}</h1>
      <p className="lead">{description}</p>
      <section className="card placeholder">
        <span className="badge">Planned functionality</span>
        <h2>A foundation for safer work</h2>
        <p>
          This page is a structural placeholder. Training records and management
          tools have not been implemented.
        </p>
      </section>
      <section className="scope-panel">
        <h2>Initial training scope</h2>
        <div className="module-grid">
          <article className="card">
            <span className="module-number">01</span>
            <h3>Manual Handling</h3>
            <p>Main module planned for the A7 prototype demonstration.</p>
          </article>
          <article className="card">
            <span className="module-number">02</span>
            <h3>Forklift and Pedestrian Safety</h3>
            <p>Included in the initial system’s training scope.</p>
          </article>
        </div>
      </section>
    </>
  );
}
