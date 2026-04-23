/** Resume Text Processing : pipeline: Extract → Normalize → Parse Projects → Filter → Prompt


/*
 * Normalize resume text by : 
   Converts Windows-style line endings (\r\n) to Unix-style (\n)
   Removes extra spaces at start/end
   If there are 3+ line breaks, reduce to 2
 */
export function normalizeResumeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .trim()
    .replace(/\n{3,}/g, "\n\n");
}




/*
 Adds \ before special regex chars . node.js->node\.js . 
 (dot = any character) -> (literal dot) 
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()\[\]|\\]/g, "\\$&");
}




/*
 * Extract projects with their technologies from resume text
 * @param text - Normalized resume text
 * text: string → full resume text . returns → array of objects like: name tech full description
 */

export function extractProjectsWithTech(
  text: string,
  maxProjects: number = 5
): { name: string; tech: string[]; fullText: string }[] {
  
  const lines = text.split("\n"); // Takes whole resume text -> splits into individual lines
  const projects: { name: string; tech: string[]; fullText: string }[] = []; // empty list to store proj . proj name tech used text of proj
  const seenNames = new Set<string>(); // same project isn't added twice

  // Find the PROJECTS section
  let projectSectionStart = -1; // to remember which line the Projects section starts at
  for (let i = 0; i < lines.length; i++) {
    if (/^(projects|project work|side projects)/i.test(lines[i].trim())) { // checks for word
      projectSectionStart = i + 1; // next line's number as the start of projects
      break; // break when found
    }
  }

  if (projectSectionStart === -1) return []; // no PROJECTS section found → return empty

  // Parse projects in the section
  let i = projectSectionStart;
  // Keeps looping until end of text OR until maxProjects are found (max limit)
  while (i < lines.length && projects.length < maxProjects) {
    const line = lines[i].trim(); // Gets the current line and removes extra spaces from it

    if (!line) { i++; continue; } // skip empty lines

    // Stop if we hit another major section like exp, edu etc
    if (/^(experience|education|skills|certifications|summary|contact|profile|achievements|awards)/i.test(line)) {
      break;
    }

    // Bullet lines (•, -, *) are NEVER project titles — skip them
    const isBullet = /^[•\-\*]/.test(line) || /^\s*[•\-\*]/.test(lines[i]); // checks for bullet points
    if (isBullet) { i++; continue; }

    // Project title MUST contain "|" e.g. "Studynotion | MERN Stack" → if no "|" skip this line
    if (!line.includes("|")) { i++; continue; }

    // Splits the line by | . Takes the first part as the project name
    const parts = line.split("|");
    const rawName = parts[0].trim(); // left of "|" = project name
    const afterPipe = parts[1]?.trim() ?? ""; // right of "|" = tech list or description

    // Skip if project name part is empty or starts with bullet (likely not a real project title)
    if (!rawName || /^[•\-\*]/.test(rawName)) { i++; continue; }

    // Clean project name — remove trailing dashes e.g. "Agri360-" → "Agri360"
    const projectName = rawName.replace(/[-–—]+$/, "").trim();

    // Skip proj if name too short (less than 2 chars) or already seen
    if (projectName.length < 2 || seenNames.has(projectName.toLowerCase())) {
      i++;
      continue;
    }

    // Collect full description (next few lines until empty line or next project)
    const descriptionLines: string[] = []; // empty list to store description lines
    // starts from the line just below the project title
    let j = i + 1;
    // until end of text OR max 12 description lines collected
    while (j < lines.length && descriptionLines.length < 12) {
      const nextLine = lines[j].trim();

      if (!nextLine) break; // stop at empty line

      // Stop if we hit another major section like exp, edu etc
      if (/^(experience|education|skills|certifications|summary|contact|profile|achievements|awards)/i.test(nextLine)) break;

      // Stop if next line is a new project title (has "|" and is NOT a bullet)
      const nextIsBullet = /^[•\-\*]/.test(nextLine) || /^\s*[•\-\*]/.test(lines[j]); // checks for bullet points
      if (!nextIsBullet && nextLine.includes("|")) break; // next project title found → stop collecting

      descriptionLines.push(nextLine); // collect this line as part of current project description
      j++;
    }

    // Extract technologies (after "|" if it has commas → real tech list)
    let techs: string[] = [];
    if (afterPipe.length > 0) {
      // Strip dates merged into tech string by pdf-parse e.g. "Machine Learning, CNN Aug 2024– Nov 2024"
      const cleanedAfterPipe = afterPipe
        .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[-–]\s*(Ongoing|\d{4})\b/gi, "")
        .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/gi, "")
        .replace(/\bOngoing\b/gi, "")
        .trim()
        .replace(/,\s*$/, ""); // remove trailing comma left after date is stripped
    
      if (cleanedAfterPipe.length > 0) {
        techs = cleanedAfterPipe
          .split(",")
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .slice(0, 10);
      }
    }

    // Always scan bullet points for tech stack line and merge with | extracted techs
    const techBullet = descriptionLines.find(l =>
      l.toLowerCase().includes("tech stack:") || // e.g. "• Tech Stack: Python, FAISS..."
      l.toLowerCase().includes("technologies:") ||
      l.toLowerCase().includes("built with:")
    );

    if (techBullet) {
      const techStr = techBullet.split(":").slice(1).join(":").trim(); // get everything after first ":" handles colons inside tech names e.g. "GPT-4.1"
      const bulletTechs = techStr
        .split(",") // split into individual techs
        .map(t => t.trim()) // remove spaces
        .filter(t => t.length > 0) // remove empty items
        .slice(0, 10);

      // Merge without duplicates while preserving existing order
      const existing = new Set(techs.map(t => t.toLowerCase())); // track already-added techs
      bulletTechs.forEach((t) => {
        if (!existing.has(t.toLowerCase())) { // only add if not already in list
          techs.push(t);
          existing.add(t.toLowerCase());
        }
      });
    }

    const fullText = [line, ...descriptionLines].join("\n").trim(); // combine title + description into one block of text

    projects.push({
      name: projectName,
      tech: techs,
      fullText,
    });

    seenNames.add(projectName.toLowerCase()); // Adds the project name to seenNames so it's not added again later
    i = j; // jumps i to where we stopped collecting description lines
    continue; // to check next line
  }
  return projects;
}



/**
 * Filter projects based on user tech stack
 * 0 matched → fallback to top 2 projects from resume
 * 1 matched → return that 1 project only (all questions about it)
 * 2+ matched → return all matched projects (LLM distributes questions)
 */
export function filterProjectsByTech(
  projects: { name: string; tech: string[]; fullText: string }[],
  userTechStack: string[]
): { name: string; tech: string[]; fullText: string }[] {

  // no projects or no tech stack → return top 2 as fallback
  if (!projects.length || !userTechStack.length) {
    return projects.slice(0, 2);
  }

  // normalize user tech to lowercase for comparison
  const normalizedUserTech = userTechStack
    .map(t => t.toLowerCase().trim())
    .filter(t => t.length > 0);

  // find projects whose tech list overlaps with user's requested tech
  const matchedProjects = projects.filter(project =>
    project.tech.some(projectTech => {
      const normalizedProjectTech = projectTech.toLowerCase().trim();
      return normalizedUserTech.some(userTech => {
        if (normalizedProjectTech === userTech) return true; // exact match e.g. "react" === "react"
        const regex = new RegExp(`\\b${escapeRegex(userTech)}\\b`, "i"); // partial match e.g. "react.js" matches "react"
        return regex.test(normalizedProjectTech);
      });
    })
  );

  // 0 matched → fallback to top 2 projects
  if (matchedProjects.length === 0) {
    return projects.slice(0, 2);
  }

  // 1+ matched → return only matched projects
  return matchedProjects;
}