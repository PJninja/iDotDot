import type { Project } from './project';
import shot from './placeholder-b/shot-1.svg';

const project: Project = {
  id: 'placeholder-b',
  title: 'Placeholder project B',
  summary: 'A second stand-in entry, with a wooden border that can burn.',
  tags: ['Placeholder', 'Sample', 'Wood border'],
  icon:
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">' +
    '<rect x="4" y="4" width="4" height="16"/><rect x="10" y="8" width="4" height="12"/><rect x="16" y="12" width="4" height="8"/></svg>',
  border: 'wood',
  order: 3,
  blurb: 'This entry exists so the board has something to show. Copy it to a new file in src/projects and fill in the fields.',
  sections: [{ heading: 'About this entry', body: 'Each project picks the material of its ring with the border field: stone, steel, wood or ice.' }],
  screenshots: [{ src: shot, alt: 'Placeholder screenshot' }],
  links: [],
  role: 'To be filled in',
  timeline: 'To be filled in',
  stack: ['To be filled in'],
  outcome: 'To be filled in.',
};

export default project;
