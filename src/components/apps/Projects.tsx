import { ExternalLink, Globe, Lock } from 'lucide-react';

interface Project {
  title: string;
  description: string;
  tech: string[];
  /** GitHub repo URL; omit for private/unpublished work */
  link?: string;
  /** Deployed site URL, if any */
  live?: string;
}

const PROJECTS: Project[] = [
  {
    title: 'GTOtutor',
    description:
      'Full-stack poker trainer that grades decisions against GTO charts at heads-up and 6-max tables, using a custom Rust preflop solver, live turn/river solves on AWS Lambda, and a Claude-powered coach that explains solver decisions and spots leaks.',
    tech: ['TypeScript', 'React', 'Fastify', 'PostgreSQL', 'Rust', 'AWS', 'Claude API'],
    link: 'https://github.com/JordanCa0/GTOtutor',
    live: 'https://gtotutor.app',
  },
  {
    title: 'Portfolio OS',
    description:
      'This site. A portfolio styled as a Hyprland desktop, with a tiling window manager, edge and corner snapping, and a working terminal.',
    tech: ['React', 'TypeScript', 'Tailwind', 'Framer Motion'],
    link: 'https://github.com/JordanCa0/portfolioOS',
  },
  {
    title: 'Donor Prediction & Segmentation Dashboard',
    description:
      'Predictive analytics for donor outreach: models in Python, SQL pipelines, and Matplotlib/Power BI visualizations for non-technical stakeholders.',
    tech: ['Python', 'SQL', 'VBA', 'Power BI'],
  },
  {
    title: 'WSI Classification Study',
    description:
      'Whole-slide image classification from Phikon-2 features. Leiden clustering beat PCA-based K-means (weighted F1 0.944 vs ~0.83), and a Genetic Algorithm cut the feature space by 95% (201 to 10) while keeping F1 at 0.905.',
    tech: ['Python', 'Leiden Clustering', 'Genetic Algorithms', 'Phikon-2'],
    link: 'https://github.com/JordanCa0/phikon-2_WSI-Feature-Extractor',
  },
];

export default function Projects() {
  return (
    <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
      {PROJECTS.map((p) => (
        <article
          key={p.title}
          className="flex flex-col rounded-lg border border-edge bg-chrome p-4"
        >
          <h3 className="text-sm font-semibold">{p.title}</h3>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-body-muted">
            {p.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.tech.map((t) => (
              <span
                key={t}
                className="rounded-full border border-edge px-2 py-0.5 text-[10px] text-accent-soft"
              >
                {t}
              </span>
            ))}
          </div>
          {p.link ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {p.live && (
                <a
                  href={p.live}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-soft transition-colors hover:text-accent-hover"
                >
                  <Globe size={12} /> Live site
                </a>
              )}
              <a
                href={p.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent-soft transition-colors hover:text-accent-hover"
              >
                <ExternalLink size={12} /> View on GitHub
              </a>
            </div>
          ) : (
            <span className="mt-3 inline-flex items-center gap-1 text-xs text-body-muted">
              <Lock size={12} /> Private repo, code available on request
            </span>
          )}
        </article>
      ))}
    </div>
  );
}
