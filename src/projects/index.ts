import { BORDER_MATERIALS, type Project } from './project';

const modules = import.meta.glob<{ default: Project }>(['./*.ts', '!./index.ts', '!./project.ts'], { eager: true });

function validate(project: Project, file: string): void {
  const fail = (what: string): never => {
    throw new Error(`${file}: ${what}`);
  };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(project.id)) fail(`id "${project.id}" is not kebab-case`);
  if (project.tags.length !== 3 || project.tags.some((t) => t.trim() === '')) fail('needs exactly three non-empty tags');
  if (!BORDER_MATERIALS.includes(project.border)) fail(`unknown border material "${project.border}"`);
  if (project.screenshots.length === 0) fail('needs at least one screenshot');
  if (project.screenshots.some((s) => s.alt.trim() === '')) fail('every screenshot needs alt text');
  if (project.stack.length === 0) fail('needs a stack');
  for (const field of ['title', 'summary', 'blurb', 'role', 'timeline', 'outcome'] as const) {
    if (project[field].trim() === '') fail(`${field} is empty`);
  }
}

/** Every project in `src/projects/*.ts`, validated and sorted by `order`. */
export function loadProjects(): Project[] {
  const projects: Project[] = [];
  const seen = new Set<string>();
  for (const [file, mod] of Object.entries(modules)) {
    if (!mod.default) continue;
    validate(mod.default, file);
    if (seen.has(mod.default.id)) throw new Error(`${file}: duplicate project id "${mod.default.id}"`);
    seen.add(mod.default.id);
    projects.push(mod.default);
  }
  return projects.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}
