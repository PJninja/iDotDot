import type { Project } from './project';
import fire from './idotdot/shot-fire.svg';
import world from './idotdot/shot-world.svg';

const project: Project = {
  id: 'idotdot',
  title: 'iDotDot',
  summary: 'This site: a falling-sands world simulated on the GPU.',
  tags: ['WebGPU', 'TypeScript', 'Simulation'],
  icon:
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">' +
    '<rect x="3" y="17" width="18" height="4"/><rect x="6" y="13" width="12" height="4"/>' +
    '<rect x="9" y="9" width="6" height="4"/><rect x="11" y="4" width="2" height="2"/></svg>',
  border: 'stone',
  order: 1,
  blurb:
    'Every tile on the page is a cell in a WebGPU compute simulation. Sand piles up, water flows, wood burns, and the portfolio you are reading is made of solid objects in the same world.',
  sections: [
    {
      heading: 'What it is',
      body: 'A personal site where the whole page is a falling-sands simulation. The grid lives in GPU storage buffers and each step runs as indirect compute dispatches over the chunks that are awake, so a resting world costs almost nothing.',
    },
    {
      heading: 'How the page fits in',
      body: 'HTML elements are measured into the grid and become solid, so sand rests on them and fire cannot pass through them. Each card is ringed with real tiles of its own material.',
    },
  ],
  screenshots: [
    { src: world, alt: 'A pile of sand beside a pool of water and a wooden frame', caption: 'Sand, water and a wooden frame' },
    { src: fire, alt: 'A wooden block burning with flames and smoke above it', caption: 'Fire spreading through wood' },
  ],
  links: [{ label: 'Source on GitHub', href: 'https://github.com/PJninja/iDotDot' }],
  role: 'Design and engineering',
  timeline: '2026',
  stack: ['TypeScript', 'WebGPU', 'WGSL', 'Vite'],
  outcome: 'Runs at a fixed 60 Hz on the GPU with no runtime dependencies.',
};

export default project;
