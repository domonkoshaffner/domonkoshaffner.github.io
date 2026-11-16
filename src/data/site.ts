/**
 * All site content lives here. Edit this file, not the components.
 *
 * Publishing rules (see AGENTS.md): only public-safe facts. Customers may be
 * named only if they have been publicly linked to DiffuseDrive (AISIN,
 * Continental, Denso). A `public: false` flag only hides rendered content;
 * source files may still be public. Keep private drafts in ignored `.local/`.
 */

export const profile = {
  name: 'Domonkos Haffner',
  role: 'Physicist and founding AI architect',
  headline: 'From the training data machines are missing to understanding what robots actually did, I build the systems in between.',
  description:
    'Domonkos Haffner is a physicist and founding AI architect working on robotics, generative AI, and synthetic data. Based in Salzburg.',
  linkedin: 'https://www.linkedin.com/in/domonkos-haffner-798063203/',
  github: 'https://github.com/domonkoshaffner',
};

export const blackHole = {
  singularity: {
    title: 'Approaching the singularity.',
    description: 'From gravitational collapse to the emergence of superintelligence.',
  },
  note: 'Artistic interpretation. Light paths and motion are simplified.',
  credit: {
    label: 'Inspired by NASA’s black hole simulation.',
    url: 'https://www.youtube.com/watch?v=dGEIsnBRWGs',
  },
};

export const sections = [
  { id: 'about', title: 'About', href: '/#about' },
  { id: 'work', title: 'Work', href: '/#work' },
  { id: 'background', title: 'Background', href: '/#background' },
  { id: 'blog', title: 'Blog', href: '/blog/' },
  { id: 'projects', title: 'Projects', href: '/projects/' },
  { id: 'books', title: 'Books', href: '/books/' },
  { id: 'contact', title: 'Contact', href: '/#contact' },
];

export const now = [
  'My current work at Atomic Skills Industries by DiffuseDrive is in robotics: building systems that help us understand what a robot actually did, where it struggled, and how its behaviour changes. It brings together simulation, sensor data, and machine learning to make robot behaviour easier to interpret and evaluate.',
  'Before that, I was the principal architect of ATLAS, our self-serve, air-gapped synthetic-data platform. I built the core pipelines for domain and instance adaptation, captioning, and quality control. That included work for a leading U.S. defense prime.',
];

export const portrait = {
  src: '/images/portrait.jpg',
  width: 600,
  height: 900,
  alt: 'Portrait of Domonkos Haffner',
  caption: 'Portrait, resolved through a denoising schedule.',
  replay: 'Denoise again',
  resolved: 'resolved',
  step: 'step',
};

export const labels = {
  selectedWork: 'Selected work',
  recognition: 'Recognition',
  affiliations: 'Affiliations',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  menu: 'Menu',
  experience: 'Experience',
  research: 'Research & studies',
  press: 'In the press',
  talks: 'Talks',
  education: 'Education',
  skills: 'Skills',
};

export const navigation = sections.map(({ id, title, href }) => ({
  section: id, title, href,
}));

export const projectPage = {
  title: 'Projects',
  eyebrow: 'From the workbench',
  description: 'A growing collection of personal projects I’ve really enjoyed building, inspired by everyday life and curiosity.',
  homeDescription: 'Personal projects I’ve really enjoyed building, from skating and sensing to a macro tracker I used for years.',
  emptyTitle: 'Selected projects coming soon.',
  emptyText: 'A closer look at the code, ideas, and details behind the things I build.',
  visit: 'View project',
  browse: 'Explore projects',
  github: 'Explore my GitHub',
  home: 'Back to the homepage',
};

export interface Project {
  id: string;
  title: string;
  eyebrow?: string;
  featured?: boolean;
  summary: string;
  story?: string[];
  workflow?: { title: string; description: string }[];
  releaseNote?: string;
  url?: string;
  linkLabel?: string;
  /** Only explicitly public projects appear on the website. */
  public: boolean;
}

// Only public descriptions belong here. Private project notes and recorded
// location data stay outside the website and its source repository.
export const projects: Project[] = [
  {
    id: 'smoothskate',
    title: 'SmoothSkate',
    eyebrow: 'Featured personal project',
    featured: true,
    summary: 'Predicting road surface smoothness from accelerometer and gyroscope data.',
    story: [
      'Skating is how I get around, exercise, and unwind. Over time, I’ve built a detailed mental map of Budapest and Salzburg: the smooth stretches, the rough ones, and the routes I keep coming back to. SmoothSkate began as a way to turn that map into data.',
      'I started with an iPhone app to record GPS routes and rate surfaces from 1 to 3, with 3 being the smoothest, using voice or a tap. My wife suggested adding an inertial measurement unit to the skate so I could learn to predict those ratings from accelerometer and gyroscope recordings.',
    ],
    workflow: [
      {
        title: 'From recordings to predictions',
        description: 'Capsule Studio, the Mac app, aligns the recordings and annotations for inspection. I then engineer features and train temporal convolutional networks to predict surface smoothness.',
      },
      {
        title: 'Accounting for how I skate',
        description: 'The sensor also picks up my pushes, speed, and technique. I’m collecting data at different speeds and with different skating styles to help the model separate those effects from the surface.',
      },
    ],
    releaseNote: 'Actively collecting training data and experimenting with networks. I plan to open-source the full project soon, including the iPhone app, sensor firmware, Mac app, and machine-learning tools, once I’m happy with the prediction quality.',
    public: true,
  },
  {
    id: 'go-value-network',
    title: '9×9 Go Value Network',
    eyebrow: 'Work in progress',
    summary: 'An AlphaGo-style project on 9×9 Go, starting with a network that predicts the winner from a board position.',
    story: [
      'I play Go, and AlphaGo’s win over Lee Sedol in 2016 is a big part of why I got into neural networks. This project rebuilds its core ideas on a 9×9 board, one stage at a time: a value network trained on human games first, then self-play, then tree search.',
      'The first stage is done. I streamed 12.2 million online games into a compact dataset, filtered them down to 146,000 even, ranked games between stronger players, and trained a small ResNet that estimates who will win from any board position.',
    ],
    releaseNote: 'Results and source code are coming soon. Next up: self-play, then Monte Carlo tree search.',
    public: true,
  },
  {
    id: 'macro-app',
    title: 'Macro App',
    eyebrow: 'Personal nutrition tracker',
    summary: 'A Google Sheets food log turned into daily calorie and macro summaries.',
    story: [
      'I built this during university to track my macros through bulking and cutting phases. Paying for a subscription felt unnecessary when I could write the tool myself. It was simple, but useful enough that I kept using it for years.',
      'Over time, I built up a sizeable reference table of shop-bought foods and my own recipes, recording protein, carbohydrates, fat, fibre, and sugar. A Python notebook reads the meals logged in Google Sheets and turns them into a daily table of calories and macros.',
    ],
    url: 'https://github.com/domonkoshaffner/macro-app',
    linkLabel: 'View source on GitHub',
    public: true,
  },
  {
    id: 'word-trainer',
    title: 'Word Trainer',
    eyebrow: 'Personal vocabulary trainer',
    summary: 'A German vocabulary trainer that drills me on words from my own spreadsheet.',
    story: [
      'I built this while learning German. I kept collecting new words in an Excel file, one sheet per topic, each with its translation and an example sentence from wherever I’d found it. I wanted something that would drill me on that file rather than yet another app with someone else’s word lists.',
      'The spreadsheet stays the source of truth. A small Node server reads it, and a single-page trainer turns each batch into true-or-false, multiple-choice, matching, sentence-unscrambling and typing exercises, with a review batch for mistakes and a timed test. It runs locally and looks like a 1980s CRT terminal.',
    ],
    url: 'https://github.com/domonkoshaffner/word-trainer',
    linkLabel: 'View source on GitHub',
    public: true,
  },
  {
    id: 'cityskate',
    title: 'CitySkate',
    eyebrow: 'Skating films',
    summary: 'Short skating films I’ve made around Budapest and Austria.',
    url: 'https://www.youtube.com/@cityskate3106/videos',
    linkLabel: 'Watch on YouTube',
    public: true,
  },
];

export interface Experience {
  dates: string;
  role: string;
  org: string;
  summary?: string;
  focus?: string;
  highlights?: string[];
}

export const experience: Experience[] = [
  {
    dates: 'Jul 2026 – present',
    role: 'Founding AI Architect',
    org: 'Atomic Skills Industries by DiffuseDrive, San Francisco (working from Salzburg)',
    focus: 'Robotics and autonomous systems',
    summary:
      'Building tools to understand and evaluate robot behaviour, connecting simulation and sensor data with machine learning.',
    highlights: [
      'Developing robot-behaviour annotation and evaluation workflows, from individual actions to complete task executions.',
      'Working with simulated manipulation tasks and recorded robot data to study success, failure, and recovery.',
      'Bringing a physics background to the interpretation of motion, contact, and object interactions.',
    ],
  },
  {
    dates: 'Sep 2024 – Jun 2026',
    role: 'Founding Generative AI Engineer and AI Architect',
    org: 'DiffuseDrive, San Francisco (working from Salzburg)',
    focus: 'ATLAS · Synthetic data',
    summary:
      'Joined as a founding generative AI engineer; appointed AI Architect in March 2026, with final design authority for the AI domain. Principal architect of the ATLAS synthetic-data platform and its core generative pipelines.',
    highlights: [
      'Built domain and instance adaptation, captioning, and quality-control pipelines for sensor-matched training data.',
      'Architected the platform’s model layer so successive frontier image-generation models could be swapped in without rebuilding the product, and re-engineered them to run entirely offline in air-gapped networks.',
      'Led technical direction, engineering reviews, and mentoring while delivering a self-serve platform for air-gapped environments.',
    ],
  },
  {
    dates: 'Jun 2022 – Aug 2024',
    role: 'Lead Data Scientist',
    org: 'HOFER (ALDI Süd), Salzburg',
    focus: 'Product intelligence and cost modelling',
    summary:
      'Built machine-learning systems that turned product descriptions and images into structured ingredient data, filling gaps in ALDI’s central product database. The resulting data supported cost modelling and supplier negotiations across international markets.',
    highlights: [
      'Fine-tuned a language model to derive ingredient information from product descriptions, validating its predictions against actual ingredient lists.',
      'Built an end-to-end workflow to extract ingredients from product imagery and match them to the corresponding articles, creating a reusable central ingredient repository.',
      'Contributed convolutional neural network work to distinguish temporary price shocks from structural inflation in food ingredients.',
    ],
  },
  {
    dates: 'Jun 2021 – May 2022',
    role: 'Data Scientist',
    org: 'neke-neke, Salzburg',
    focus: 'Computer vision and generative models',
    summary:
      'Computer vision and NLP projects: convolutional networks for facial-feature recognition and a GAN pipeline for synthetic training data.',
    highlights: [
      'Led facial-feature recognition experiments, comparing convolutional-network architectures and using generated data to support training.',
      'Built computer-vision services in Azure and NLP workflows for analysing customer data.',
      'Made chatbot analytics accessible through React interfaces and Power BI reporting.',
    ],
  },
  {
    dates: 'Dec 2020 – Jun 2021',
    role: 'Data Analyst',
    org: 'PaddleMate',
    focus: 'Sports performance analytics',
    summary: 'Performance analytics for paddle-sport athletes, translating velocity and technique data into insights for training.',
    highlights: [
      'Developed performance-evaluation algorithms and handled data processing, transformation, and visualisation from raw measurements to reports.',
    ],
  },
];

export interface Publication {
  title: string;
  authors: string;
  venue: string;
  year: number;
  url?: string;
  note?: string;
}

export const publications: Publication[] = [
  {
    title: 'How can GenAI and synthetic data 4X Computer Vision performance?',
    authors: 'Co-authored with the DiffuseDrive team',
    venue: 'Industry case study',
    year: 2024,
    url: 'https://diffusedrive.com/blog/how-can-genai-and-synthetic-data-4x-computer-vision-performance#hero',
    note: 'A comparison of real, synthetic, and mixed training data for aerial object detection with YOLOv5.',
  },
  {
    title: 'Localization of Scattering Objects Using Neural Networks',
    authors: 'Domonkos Haffner and Ferenc Izsák',
    venue: 'Sensors 21(1), 11',
    year: 2021,
    url: 'https://www.mdpi.com/1424-8220/21/1/11',
    note: 'Cited in SIAM Journal on Numerical Analysis 59(5), 2021.',
  },
  {
    title: 'Solving the Laplace Equation by Using Neural Networks',
    authors: 'Domonkos Haffner and Ferenc Izsák',
    venue: 'Developments in Computer Science, ELTE Faculty of Informatics, pp. 143–146',
    year: 2021,
    url: 'https://real.mtak.hu/138400/',
  },
];

export const researchProfiles = [
  { title: 'Google Scholar', url: 'https://scholar.google.com/citations?user=pZQRhckAAAAJ&hl=en' },
  { title: 'OpenReview', url: 'https://openreview.net/profile?id=%7EDomonkos_Haffner1' },
];

export interface PressArticle {
  title: string;
  publisher: string;
  kind: string;
  /** Publication date in YYYY-MM-DD format. */
  date: string;
  summary: string;
  url: string;
}

export const pressArticles: PressArticle[] = [
  {
    title: 'The Future of Physical AI Won’t Be Built on More Data, but Better Data',
    publisher: 'Startup Kitchen',
    kind: 'Interview',
    date: '2026-09-22',
    summary: 'A conversation about my work on targeted synthetic data, rigorous evaluation, and building reliable AI systems.',
    url: 'https://startupkitchen.community/the-future-of-physical-ai/',
  },
  {
    title: 'The New Infrastructure Behind Physical AI',
    publisher: 'Startup Kitchen',
    kind: 'Team feature',
    date: '2026-09-14',
    summary: 'Inside the DiffuseDrive engineering team’s work on controllable generation, AI architecture, and secure deployment.',
    url: 'https://startupkitchen.community/the-new-infrastructure-behind-physical-ai-meet-the-engineers-building-synthetic-data-for-mission-critical-machines/',
  },
];

export interface Talk {
  year: number | string;
  title: string;
  venue: string;
  note?: string;
}

export const talks: Talk[] = [
  {
    year: 2021,
    title: 'Solving the Laplace equation by using neural networks',
    venue: 'Developments in Computer Science, ELTE, Budapest',
  },
  {
    year: 2020,
    title: 'Solving localization tasks using neural networks',
    venue: 'ELTE Physics Scientific Students’ Conference (TDK)',
    note: 'Third place and the Morgan Stanley special prize',
  },
  {
    year: 2020,
    title: 'Localization of scattering objects using neural networks',
    venue: 'HU-MATHS-IN workshop on mathematics in industry',
  },
  {
    year: '2019–2021',
    title: 'Physics outreach and science communication',
    venue: 'School talks and physics demonstrations',
  },
];

export interface Recognition {
  year: string;
  title: string;
  org: string;
  note?: string;
  url?: string;
  /** Set to false to keep an item out of the build. */
  public?: boolean;
}

export const recognition: Recognition[] = [
  {
    year: '2026',
    title: 'Judge, CES Innovation Awards 2027',
    org: 'Consumer Technology Association',
    note: '14 products evaluated',
    url: 'https://cta.secure-platform.com/ces-judging-application/gallery?roundId=82014',
  },
  {
    year: '2020',
    title: 'Morgan Stanley special prize for the most innovative research',
    org: 'ELTE Physics Scientific Students’ Conference',
  },
  {
    year: '2020–21',
    title: 'Competitive research scholarship, awarded twice',
    org: 'ELTE Faculty of Informatics',
  },
];

export const education = [
  { dates: '2019 – 2021', title: 'MSc in Physics, Physics and Data Science track', org: 'Eötvös Loránd University, Budapest' },
  { dates: '2016 – 2017', title: 'Materials science studies, MSc level', org: 'University of Salzburg' },
  { dates: '2015 – 2019', title: 'BSc in Physics', org: 'Eötvös Loránd University, Budapest' },
];

export const affiliations = [
  { role: 'Member', org: 'Mensa International', url: 'https://www.mensa.org/' },
  { role: 'Member', org: 'GO-Club Salzburg', url: 'https://www.argekultur.at/go-club/' },
  { role: 'Former member', org: 'ELTE AI Research Group', url: 'https://ai.elte.hu/' },
];

export const skills = [
  { group: 'Generative AI', items: ['Diffusion models', 'LoRA and DreamBooth', 'domain adaptation', 'synthetic-data pipelines', 'language and vision-language models'] },
  { group: 'Robotics', items: ['Isaac Sim and Isaac Lab', 'Newton and MuJoCo-Warp', 'vision-language-action models (GR00T)', 'VLM-as-a-judge evaluation', 'temporal segmentation (MS-TCN, ASFormer)', 'robot-behaviour annotation', 'simulation-to-real evaluation'] },
  { group: 'Computer vision', items: ['Image embeddings and retrieval', 'detection and segmentation', 'CLIP', 'DINO', 'SAM', 'YOLO'] },
  { group: 'ML engineering', items: ['PyTorch', 'Hugging Face Diffusers and Transformers', 'Hydra', 'training and evaluation pipelines', 'data curation'] },
  { group: 'Production', items: ['Azure ML', 'AWS', 'Palantir Foundry', 'Docker', 'Terraform', 'air-gapped deployment'] },
  { group: 'Technical leadership', items: ['AI architecture', 'technical direction', 'hiring', 'mentoring', 'engineering reviews'] },
  { group: 'Languages', items: ['Python', 'C++', 'SQL', 'JavaScript', 'Java'] },
  { group: 'Spoken', items: ['Hungarian (native)', 'English (C1)', 'German (B2)'] },
];

export const contact =
  'The fastest way to reach me is on LinkedIn. I am happy to talk about robotics, synthetic data, generative models in production, and physics-flavoured machine learning.';

export const blog = {
  title: 'Blog',
  eyebrow: 'Thoughts and questions',
  description: 'Personal reflections on physics, superintelligence, and the ideas I’m still exploring.',
  homeDescription: 'Thoughts on physics, superintelligence, and the questions that keep me curious.',
  topics: ['Physics', 'Superintelligence', 'Ideas'],
  visit: 'Visit the blog',
  back: 'All posts',
  home: 'Back to the homepage',
  emptyTitle: 'First notes coming soon.',
  emptyText: 'Essays and reflections on the questions I keep coming back to.',
  read: 'Read post',
};

export type BlogBlock =
  | { type: 'paragraph' | 'heading' | 'quote'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; code: string; language?: string };

export interface BlogPost {
  slug: string;
  title: string;
  /** Publication date in YYYY-MM-DD format. */
  date: string;
  summary: string;
  /** Only explicitly public posts receive a page or appear in the index. */
  public: boolean;
  body: BlogBlock[];
}

export interface ExternalBlogPost extends Omit<BlogPost, 'slug' | 'body'> {
  url: string;
  publication: string;
  readLabel: string;
}

// Only publicly shareable posts belong here. Write private drafts in .local/;
// public: false keeps a post out of the build, but does not hide its source.
export const blogPosts: (BlogPost | ExternalBlogPost)[] = [];

export const publishedPosts = blogPosts
  .filter((post) => post.public === true)
  .sort((a, b) => b.date.localeCompare(a.date));

export const bookPage = {
  title: 'Books',
  eyebrow: 'From my bookshelf',
  description: 'A selection of books I’ve really enjoyed and would recommend to anyone.',
  visit: 'Browse my recommendations',
  home: 'Back to the homepage',
};

// Display order is intentional. Keep this as one list without category headings.
export const books = [
  {
    title: 'Black Holes: The Key to Understanding the Universe',
    authors: 'Brian Cox & Jeff Forshaw',
    url: 'https://books.google.com/books/about/Black_Holes.html?id=swE4EAAAQBAJ&hl=en',
  },
  {
    title: 'The Quantum Universe',
    authors: 'Brian Cox & Jeff Forshaw',
    url: 'https://books.google.com/books/about/The_Quantum_Universe.html?id=LfHLzZZzgacC&hl=en',
  },
  {
    title: 'The Theory of Everything',
    authors: 'Stephen Hawking',
    url: 'https://books.google.com/books/about/The_Theory_Of_Everything.html?id=JbRyIIeGLcIC&hl=en',
  },
  {
    title: 'Co-Intelligence',
    authors: 'Ethan Mollick',
    url: 'https://books.google.com/books/about/Co_Intelligence.html?id=J2HgEAAAQBAJ&hl=en',
  },
  {
    title: 'The Infinity Machine',
    authors: 'Sebastian Mallaby',
    url: 'https://books.google.com/books/about/The_Infinity_Machine.html?id=E7eJEQAAQBAJ&hl=en',
  },
  {
    title: 'If Anyone Builds It, Everyone Dies',
    authors: 'Eliezer Yudkowsky & Nate Soares',
    url: 'https://books.google.com/books/about/If_Anyone_Builds_It_Everyone_Dies.html?id=8ZNLEQAAQBAJ&hl=en',
  },
  {
    title: 'Meditations',
    authors: 'Marcus Aurelius',
    url: 'https://books.google.com/books/about/Meditations.html?id=ISOPEAAAQBAJ&hl=en',
  },
  {
    title: 'Letters from a Stoic',
    authors: 'Seneca',
    url: 'https://books.google.com/books/about/Letters_from_a_Stoic.html?id=aJjjCj8CZXwC&hl=en',
  },
  {
    title: 'Breakfast with Seneca',
    authors: 'David Fideler',
    url: 'https://books.google.com/books/about/Breakfast_with_Seneca.html?id=XT4fEAAAQBAJ&hl=en',
  },
  {
    title: 'The Daily Stoic',
    authors: 'Ryan Holiday & Stephen Hanselman',
    url: 'https://books.google.com/books/about/The_Daily_Stoic.html?id=x7uOEAAAQBAJ&hl=en',
  },
  {
    title: 'Ego Is the Enemy',
    authors: 'Ryan Holiday',
    url: 'https://books.google.com/books/about/Ego_Is_the_Enemy.html?id=j0GXCgAAQBAJ&hl=en',
  },
  {
    title: 'The Go-Giver',
    authors: 'Bob Burg & John David Mann',
    url: 'https://books.google.com/books/about/The_Go_giver.html?id=CH0KU8XepIIC&hl=en',
  },
  {
    title: 'The Art of Persuasion',
    authors: 'Bob Burg',
    url: 'https://books.google.com/books/about/The_Art_of_Persuasion.html?id=sRG68XTQeCoC&hl=en',
  },
];
