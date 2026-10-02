import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import './trainee-resources.css';

type ResourceCategory =
  | 'Manual Handling'
  | 'General Safety'
  | 'PPE'
  | 'Emergency'
  | 'Forklift Safety';

interface SafetyResource {
  id: string;
  title: string;
  category: ResourceCategory;
  description: string;
  type: 'Quick guide' | 'Checklist' | 'Reference';
  sections: Array<{ heading: string; items: string[] }>;
  featured?: boolean;
}

const resources: SafetyResource[] = [
  {
    id: 'manual-handling-checklist',
    title: 'Manual Handling Checklist',
    category: 'Manual Handling',
    description:
      'A quick checklist for assessing a load, planning the route and using safe lifting technique.',
    type: 'Checklist',
    featured: true,
    sections: [
      {
        heading: 'Before lifting',
        items: [
          'Assess the weight, size and stability of the load.',
          'Check that the route and destination are clear.',
          'Use a suitable handling aid or ask for help when needed.',
        ],
      },
      {
        heading: 'During the lift',
        items: [
          'Use stable footing and keep the load close to your body.',
          'Move smoothly and avoid twisting your torso.',
          'Lower the load with control and keep fingers clear.',
        ],
      },
    ],
  },
  {
    id: 'safe-lifting-technique',
    title: 'Safe Lifting Technique',
    category: 'Manual Handling',
    description:
      'Key steps for preparing, lifting, carrying and lowering loads safely.',
    type: 'Quick guide',
    sections: [
      {
        heading: 'Prepare',
        items: [
          'Plan the lift and remove obstacles from the route.',
          'Position your feet securely around the load where practical.',
        ],
      },
      {
        heading: 'Lift and carry',
        items: [
          'Keep a stable posture and raise the load smoothly.',
          'Keep the load close and turn by moving your feet.',
          'Set the load down carefully in the prepared location.',
        ],
      },
    ],
  },
  {
    id: 'warehouse-hazards',
    title: 'Warehouse Hazard Identification',
    category: 'General Safety',
    description:
      'Common warehouse hazards and practical guidance for identifying unsafe conditions.',
    type: 'Reference',
    sections: [
      {
        heading: 'Look for',
        items: [
          'Blocked walkways, unstable storage and damaged equipment.',
          'Spills, poor visibility and vehicles entering pedestrian areas.',
          'Tasks that require unsuitable access or handling methods.',
        ],
      },
      {
        heading: 'Respond safely',
        items: [
          'Keep clear of immediate danger.',
          'Warn nearby colleagues where appropriate.',
          'Report the condition through your workplace process.',
        ],
      },
    ],
  },
  {
    id: 'ppe-guide',
    title: 'PPE Quick Guide',
    category: 'PPE',
    description:
      'An overview of common personal protective equipment used in warehouse environments.',
    type: 'Quick guide',
    sections: [
      {
        heading: 'Before use',
        items: [
          'Use the PPE specified for the task and work area.',
          'Check fit, condition and compatibility with other equipment.',
        ],
      },
      {
        heading: 'After use',
        items: [
          'Clean and store reusable PPE as instructed.',
          'Report damaged, missing or unsuitable equipment.',
        ],
      },
    ],
  },
  {
    id: 'emergency-procedures',
    title: 'Emergency Procedures',
    category: 'Emergency',
    description:
      'Basic actions to follow during common workplace emergency situations.',
    type: 'Reference',
    sections: [
      {
        heading: 'Immediate actions',
        items: [
          'Stop work and follow site alarms and instructions.',
          'Use the designated route to reach the assembly point.',
          'Do not re-enter until an authorized person says it is safe.',
        ],
      },
      {
        heading: 'Be prepared',
        items: [
          'Know your nearest exits and assembly location.',
          'Keep emergency routes and equipment unobstructed.',
        ],
      },
    ],
  },
  {
    id: 'forklift-pedestrian',
    title: 'Forklift & Pedestrian Safety Guide',
    category: 'Forklift Safety',
    description:
      'General safety guidance for maintaining safe separation between forklifts and pedestrians.',
    type: 'Quick guide',
    sections: [
      {
        heading: 'Safe separation',
        items: [
          'Use marked pedestrian routes and crossing points.',
          'Make sure the operator has acknowledged you before approaching.',
          'Stay outside operating zones and never walk beneath raised loads.',
        ],
      },
      {
        heading: 'Stay alert',
        items: [
          'Avoid distractions in shared vehicle areas.',
          'Listen for warnings and check blind corners before proceeding.',
        ],
      },
    ],
  },
];

const categories = [
  'All',
  ...new Set(resources.map((resource) => resource.category)),
] as const;

function ResourceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9 12h6M9 15h6" />
    </svg>
  );
}

function ResourceDialog({
  resource,
  onClose,
  returnFocusRef,
}: {
  resource: SafetyResource;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusElement = returnFocusRef.current;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusElement?.focus();
    };
  }, [onClose, returnFocusRef]);
  return (
    <div
      className="resource-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="resource-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-dialog-title"
      >
        <header>
          <div>
            <span>{resource.category}</span>
            <h2 id="resource-dialog-title">{resource.title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close resource"
          >
            ×
          </button>
        </header>
        <div className="resource-dialog-body">
          <p>{resource.description}</p>
          {resource.sections.map((section) => (
            <section key={section.heading}>
              <h3>{section.heading}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

export function TraineeResources() {
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [selected, setSelected] = useState<SafetyResource | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeDialog = useCallback(() => setSelected(null), []);
  const visibleResources =
    category === 'All'
      ? resources
      : resources.filter((resource) => resource.category === category);

  return (
    <div className="trainee-resources-page">
      <header className="trainee-resources-header">
        <p className="eyebrow">My Training / Resources</p>
        <h1>Safety Resources</h1>
        <p>
          Supporting guides and quick-reference material for safer warehouse
          work.
        </p>
      </header>
      <section
        className="resource-library-intro"
        aria-labelledby="resource-library-title"
      >
        <div>
          <span className="resource-library-icon">
            <ResourceIcon />
          </span>
          <div>
            <h2 id="resource-library-title">Safety Resource Library</h2>
            <p>
              Quick-reference guides to support your KISTS training and
              workplace safety knowledge.
            </p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Resources</dt>
            <dd>{resources.length}</dd>
          </div>
          <div>
            <dt>Safety topics</dt>
            <dd>{categories.length - 1}</dd>
          </div>
        </dl>
      </section>
      <nav className="resource-filters" aria-label="Resource categories">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={category === item ? 'active' : ''}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <section className="resource-grid" aria-label="Safety resources">
        {visibleResources.map((resource) => (
          <article
            className={`resource-card${resource.featured ? ' featured' : ''}`}
            key={resource.id}
          >
            <div className="resource-card-top">
              <span className="resource-card-icon">
                <ResourceIcon />
              </span>
              <span className="resource-category-badge">
                {resource.category}
              </span>
              {resource.featured ? (
                <span className="resource-featured-badge">Featured</span>
              ) : null}
            </div>
            <h2>{resource.title}</h2>
            <p>{resource.description}</p>
            <div className="resource-card-footer">
              <span>{resource.type}</span>
              <button
                ref={selected?.id === resource.id ? triggerRef : undefined}
                type="button"
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setSelected(resource);
                }}
              >
                View Resource
              </button>
            </div>
          </article>
        ))}
      </section>
      {visibleResources.length === 0 ? (
        <section className="resource-empty" role="status">
          <h2>No resources found</h2>
          <p>Try another category or search term.</p>
        </section>
      ) : null}
      {selected ? (
        <ResourceDialog
          resource={selected}
          onClose={closeDialog}
          returnFocusRef={triggerRef}
        />
      ) : null}
    </div>
  );
}
