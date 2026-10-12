import type { Project } from './project';
import shot from './placeholder-a/shot-1.svg';

const project: Project = {
  id: 'placeholder-a',
  title: 'Placeholder project A',
  summary: 'Stand-in entry. Replace this file with a real project.',
  tags: ['Placeholder', 'Sample', 'Replace me'],
  icon:
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">' +
    '<rect x="4" y="4" width="16" height="4"/><rect x="4" y="10" width="10" height="4"/><rect x="4" y="16" width="16" height="4"/></svg>',
  border: 'steel',
  order: 2,
  blurb: 'This entry exists so the board has something to show. Copy it to a new file in src/projects and fill in the fields.',
  sections: [{ heading: 'About this entry', body: 'Every project file exports one object of the Project type. See src/projects/project.ts for the fields.' }],
  screenshots: [{ src: shot, alt: 'Placeholder screenshot' }],
  links: [],
  role: 'To be filled in',
  timeline: 'To be filled in',
  stack: ['To be filled in'],
  outcome: 'To be filled in.',
};

export default project;
