// Single source of truth for quiz content, scoring and prompts. Used by client and server.

export const ARCHETYPE_CODES = ["E", "R", "S", "L", "A", "M"];

export const archetypes = {
  E: {
    name: "Explorer",
    tagline: "Never met a map you didn’t want to get lost in.",
    traits: ["curious", "restless", "first one out the door"],
    scene:
      "standing on a mountain ridge at sunrise, wearing a rugged outdoor jacket and a backpack, misty valleys stretching behind them",
    style: "golden hour light, adventure photography, shallow depth of field",
    accentColor: "#f97316",
  },
  R: {
    name: "Rockstar",
    tagline: "Main character energy, turned all the way up.",
    traits: ["loud", "magnetic", "zero chill"],
    scene:
      "on a concert stage wearing a stylish leather jacket, a guitar strap over one shoulder, bright stage lights behind them and a distant, blurred, faceless crowd in silhouette",
    style: "dramatic stage lighting, lens flare, concert photography",
    accentColor: "#ec4899",
  },
  S: {
    name: "Scientist",
    tagline: "Asks “why” until the universe gives up.",
    traits: ["sharp", "obsessive", "lowkey genius"],
    scene:
      "in a futuristic laboratory wearing a white lab coat, holographic screens and softly glowing equipment around them",
    style: "cool blue lighting, clean sci-fi look",
    accentColor: "#06b6d4",
  },
  L: {
    name: "Leader",
    tagline: "Walks in and the group chat finally has a plan.",
    traits: ["decisive", "loyal", "born organizer"],
    scene:
      "standing on a grand balcony wearing an elegant tailored outfit with a cape, a city skyline at dusk behind them and a tiny, faceless crowd far below",
    style: "warm cinematic light, majestic composition",
    accentColor: "#d4a017",
  },
  A: {
    name: "Artist",
    tagline: "Sees colors other people don’t have names for.",
    traits: ["dreamy", "expressive", "chaotic good"],
    scene:
      "in a bright art studio with paint splashes on the walls, standing beside a large colorful canvas, wearing a paint-stained apron",
    style: "soft natural window light, vibrant colors",
    accentColor: "#8b5cf6",
  },
  M: {
    name: "Mystic",
    tagline: "Knew you were going to read this.",
    traits: ["intuitive", "calm", "a little spooky"],
    scene:
      "in a glowing enchanted forest wearing a flowing robe, fireflies and soft mist around them, a faint glowing aura",
    style: "ethereal, soft fantasy lighting, magical atmosphere",
    accentColor: "#10b981",
  },
};

export const questions = [
  {
    id: "q1",
    text: "Your perfect weekend?",
    options: [
      { label: "Trek to a place I've never been", archetype: "E" },
      { label: "Concert or a big party", archetype: "R" },
      { label: "Build or learn something new", archetype: "S" },
      { label: "Paint, write, or create something", archetype: "A" },
    ],
  },
  {
    id: "q2",
    text: "In a group project, you are the...",
    options: [
      { label: "One who assigns the tasks and sets the deadline", archetype: "L" },
      { label: "One with the wild creative ideas", archetype: "A" },
      { label: "Researcher who solves the hard problems", archetype: "S" },
      { label: "One who keeps everyone's spirits high", archetype: "R" },
    ],
  },
  {
    id: "q3",
    text: "Pick a superpower.",
    options: [
      { label: "Teleportation", archetype: "E" },
      { label: "Reading minds", archetype: "M" },
      { label: "Controlling time", archetype: "S" },
      { label: "Inspiring anyone to follow you", archetype: "L" },
    ],
  },
  {
    id: "q4",
    text: "Pick a vibe.",
    options: [
      { label: "Mountain peak at sunrise", archetype: "E" },
      { label: "Neon city at night", archetype: "R" },
      { label: "Misty mystical forest", archetype: "M" },
      { label: "Sunlit studio full of color", archetype: "A" },
    ],
  },
  {
    id: "q5",
    text: "Friends describe you as...",
    options: [
      { label: "A natural leader", archetype: "L" },
      { label: "Calm and wise", archetype: "M" },
      { label: "The life of the party", archetype: "R" },
      { label: "The one who figures everything out", archetype: "S" },
    ],
  },
  {
    id: "q6",
    text: "Your motto?",
    options: [
      { label: "“Adventure awaits.”", archetype: "E" },
      { label: "“Lead from the front.”", archetype: "L" },
      { label: "“Create what doesn't exist.”", archetype: "A" },
      { label: "“Everything happens for a reason.”", archetype: "M" },
    ],
  },
];

/** answers[i] is the archetype code chosen for question i. Deterministic, no randomness. */
export function calculateArchetype(answers) {
  const tally = {};
  for (const a of answers) tally[a] = (tally[a] || 0) + 1;
  const max = Math.max(...Object.values(tally));
  const tied = new Set(Object.keys(tally).filter((k) => tally[k] === max));
  if (tied.size === 1) return [...tied][0];
  for (let i = answers.length - 1; i >= 0; i--) {
    if (tied.has(answers[i])) return answers[i];
  }
  throw new Error("calculateArchetype: no answers");
}

export function buildPrompt(code) {
  const a = archetypes[code];
  if (!a) throw new Error(`Unknown archetype: ${code}`);
  return (
    `Edit this photo so the same person is ${a.scene}. Preserve their exact facial features, ` +
    `face shape, skin tone, hairstyle, and hair color. The person is the only subject in focus and ` +
    `the only person whose face is visible. Realistic cinematic photo, ${a.style}. ` +
    `Portrait orientation, framed from the waist up, face clearly visible and well lit.`
  );
}
