import { CreateAssistantDTO } from "@vapi-ai/web/dist/api";
import { z } from "zod";
import type { Interview } from "@/types";
//
export const mappings = {
  "react.js": "react",
  reactjs: "react",
  react: "react",
  "next.js": "nextjs",
  nextjs: "nextjs",
  next: "nextjs",
  "vue.js": "vuejs",
  vuejs: "vuejs",
  vue: "vuejs",
  "express.js": "express",
  expressjs: "express",
  express: "express",
  "node.js": "nodejs",
  nodejs: "nodejs",
  node: "nodejs",
  mongodb: "mongodb",
  mongo: "mongodb",
  mongoose: "mongoose",
  mysql: "mysql",
  postgresql: "postgresql",
  sqlite: "sqlite",
  firebase: "firebase",
  docker: "docker",
  kubernetes: "kubernetes",
  aws: "aws",
  azure: "azure",
  gcp: "gcp",
  digitalocean: "digitalocean",
  heroku: "heroku",
  photoshop: "photoshop",
  "adobe photoshop": "photoshop",
  html5: "html5",
  html: "html5",
  css3: "css3",
  css: "css3",
  sass: "sass",
  scss: "sass",
  less: "less",
  tailwindcss: "tailwindcss",
  tailwind: "tailwindcss",
  bootstrap: "bootstrap",
  jquery: "jquery",
  typescript: "typescript",
  ts: "typescript",
  javascript: "javascript",
  js: "javascript",
  "angular.js": "angular",
  angularjs: "angular",
  angular: "angular",
  "ember.js": "ember",
  emberjs: "ember",
  ember: "ember",
  "backbone.js": "backbone",
  backbonejs: "backbone",
  backbone: "backbone",
  nestjs: "nestjs",
  graphql: "graphql",
  "graph ql": "graphql",
  apollo: "apollo",
  webpack: "webpack",
  babel: "babel",
  "rollup.js": "rollup",
  rollupjs: "rollup",
  rollup: "rollup",
  "parcel.js": "parcel",
  parceljs: "parcel",
  npm: "npm",
  yarn: "yarn",
  git: "git",
  github: "github",
  gitlab: "gitlab",
  bitbucket: "bitbucket",
  figma: "figma",
  prisma: "prisma",
  redux: "redux",
  flux: "flux",
  redis: "redis",
  selenium: "selenium",
  cypress: "cypress",
  jest: "jest",
  mocha: "mocha",
  chai: "chai",
  karma: "karma",
  vuex: "vuex",
  "nuxt.js": "nuxt",
  nuxtjs: "nuxt",
  nuxt: "nuxt",
  strapi: "strapi",
  wordpress: "wordpress",
  contentful: "contentful",
  netlify: "netlify",
  vercel: "vercel",
  "aws amplify": "amplify",
};






//
export const interviewer: CreateAssistantDTO = {
  name: "Interviewer",

  firstMessage: "Hello, thank you for taking time to speak with me today i am excited to learn more about you and your experience.",

  // 🎤 Speech-to-Text
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en", // ✅ Hindi + English + Hinglish
  },

  //  Voice (keep same)
  voice: {
    provider: "11labs",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    stability: 0.4,
    similarityBoost: 0.8,
    speed: 0.9,
    style: 0.5,
    useSpeakerBoost: true,
  },

  //  LLM
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are a professional AI interviewer conducting a real-time voice interview.

Language: {{language}}

========================
IMPORTANT LANGUAGE RULES
========================

- If language is "English":
  - Respond normally in professional English

STRICT RULES:
- Do NOT switch language mid-response
- Do NOT produce Hinglish sentences
- Keep output consistent with selected language

========================
INTERVIEW FLOW
========================

Follow these questions exactly:
{{questions}}

- Ask one question at a time
- Wait for user response
- Ask short follow-up if needed
- Keep conversation natural

========================
STYLE
========================

- Keep responses SHORT (voice-friendly)
- Sound natural, not robotic
- Be polite and professional

========================
ENDING
========================

- Thank the candidate
- End politely after all questions
`,
      },
    ],
  },
};

export const feedbackSchema = z.object({
  totalScore: z.number().min(0).max(100),
  categoryScores: z.array(z.object({
    name: z.enum(["Communication Skills", "Technical Knowledge", "Problem-Solving", "Cultural Fit", "Role Fit", "Confidence & Clarity"]),
    score: z.number().min(0).max(100),
    comment: z.string(),
  })).length(6),
  strengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  finalAssessment: z.string(),
});







export const interviewCovers = [
  "/adobe.png",
  "/amazon.png",
  "/facebook.png",
  "/hostinger.png",
  "/pinterest.png",
  "/quora.png",
  "/reddit.png",
  "/skype.png",
  "/spotify.png",
  "/telegram.png",
  "/tiktok.png",
  "/yahoo.png",
];

export const dummyInterviews: Interview[] = [
  {
    id: "1",
    userId: "user1",
    role: "Frontend Developer",
    type: "Technical",
    techstack: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
    level: "Junior",
    questions: ["What is React?"],
    finalized: false,
    createdAt: "2024-03-15T10:00:00Z",
  },
  {
    id: "2",
    userId: "user1",
    role: "Full Stack Developer",
    type: "Mixed",
    techstack: ["Node.js", "Express", "MongoDB", "React"],
    level: "Senior",
    questions: ["What is Node.js?"],
    finalized: false,
    createdAt: "2024-03-14T15:30:00Z",
  },
];
