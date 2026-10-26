import { Download } from 'lucide-react';

interface Entry {
  title: string;
  org: string;
  period: string;
  bullets: string[];
}

const EXPERIENCE: Entry[] = [
  {
    title: 'Software Engineering Intern',
    org: 'Mercury · San Francisco, CA (Remote)',
    period: 'Jan 2026 – May 2026',
    bullets: [
      'Designed and implemented pause/unpause functionality for autotransfer rules for 300,000+ users in a large-scale Haskell fintech backend, spanning database schema changes, domain types, SQL queries, and REST API handlers.',
      'Built database migrations and schema evolution for autotransfer rule lineage tracking, including backfill scripts and a new pause table with indexing, ensuring zero-downtime deployments on production banking infrastructure.',
      'Shipped the pause/unpause autotransfer feature end-to-end, exposing pause status and history through the API with full HSpec test coverage; adopted by over 70% of customers who use autotransfers.',
      'Participated in Agile sprint planning, stand-ups, and peer code reviews, and contributed to CI/CD pipelines to ship autotransfer disablement logic for partner bank account migrations touching millions of dollars in transfers, using Temporal workflows to guarantee reliable execution across service boundaries in a Nix-based monorepo.',
    ],
  },
  {
    title: 'Research Assistant, Machine Learning & Evolutionary Algorithms',
    org: 'Wilfrid Laurier University, supervised by Dr. Azam Asilian Bidgoli · Waterloo, ON',
    period: 'Sep 2025 – Jan 2026',
    bullets: [
      'Extracted 1024-dimensional feature vectors for 140,000+ image patches across 533 whole-slide images using Phikon-2, then applied Leiden clustering to build slide-level representations for classification.',
      'Designed a Genetic Algorithm to select the most impactful clusters via crossover and mutation, cutting computational cost while preserving model accuracy.',
    ],
  },
  {
    title: 'Data Specialist',
    org: 'Wilfrid Laurier University · Waterloo, ON',
    period: 'Jan 2025 – Apr 2025',
    bullets: [
      'Built predictive models for donor segmentation, identifying high-propensity prospects with ~85% accuracy to support targeted outreach.',
      'Created interactive dashboards and automated reporting tools for stakeholders using structured SQL queries to support real-time analytics.',
      'Validated and cleaned 100,000+ alumni records, removing duplicates and resolving inconsistencies, improving reporting accuracy by 15%.',
    ],
  },
];

const EDUCATION: Entry[] = [
  {
    title: 'BSc in Computer Science',
    org: 'Wilfrid Laurier University · Waterloo, ON',
    period: 'Oct 2026',
    bullets: [],
  },
];

function Section({ heading, entries }: { heading: string; entries: Entry[] }) {
  return (
    <section>
      <h2 className="mb-3 border-b border-edge pb-1 text-xs font-semibold uppercase tracking-widest text-accent-soft">
        {heading}
      </h2>
      <div className="space-y-4">
        {entries.map((e) => (
          <div key={e.title}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 className="text-sm font-semibold">{e.title}</h3>
              <span className="text-xs text-body-muted">{e.period}</span>
            </div>
            <p className="text-xs text-accent-soft">{e.org}</p>
            {e.bullets.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-body-muted">
                {e.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Resume() {
  return (
    <div className="space-y-7 p-6">
      <a
        href={`${import.meta.env.BASE_URL}resume.pdf`}
        download="Jordan_Cao_Resume.pdf"
        className="inline-flex items-center gap-2 rounded-lg border border-edge bg-chrome px-4 py-2 text-xs font-semibold transition-colors hover:border-accent hover:text-accent-soft"
      >
        <Download size={14} /> Download PDF
      </a>
      <Section heading="Experience" entries={EXPERIENCE} />
      <Section heading="Education" entries={EDUCATION} />
    </div>
  );
}
