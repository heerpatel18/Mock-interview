/**
 * Resume Text Processing
 * 
 * Simplified pipeline: Extract → Normalize → Parse Projects → Filter → Prompt
 * No chunking, embeddings, or complex RAG logic - just text processing utilities.
 */

/**
 * Normalize resume text by fixing line breaks and whitespace
 */
export function normalizeResumeText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim().replace(/\n{3,}/g, "\n\n");
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()\[\]|\\]/g, "\\$&");
}

/**
 * Extract projects with their technologies from resume text
 * Returns array of projects with name, tech stack, and full description
 * 
 * @param text - Normalized resume text
 * @returns Array of projects (max 5) with name, tech stack, and full description
 */
export function extractProjectsWithTech(text: string): { name: string; tech: string[]; fullText: string }[] {
  const lines = text.split("\n");
  const projects: { name: string; tech: string[]; fullText: string }[] = [];
  const seenNames = new Set<string>();
  
  // Find the PROJECTS section
  let projectSectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(projects|project work|side projects)/i.test(lines[i].trim())) {
      projectSectionStart = i + 1;
      break;
    }
  }
  
  if (projectSectionStart === -1) return [];
  
  // Parse projects in the section
  let i = projectSectionStart;
  while (i < lines.length && projects.length < 5) {
    const line = lines[i].trim();
    
    // Stop if we hit another major section
    if (/^(experience|education|skills|certifications|summary|contact|profile)/i.test(line)) {
      break;
    }
    
    // Detect project title patterns (contains "|" or starts with capital letters)
    if (line.includes("|") || /^[A-Z][a-zA-Z\s]+[\s|—–]/.test(line)) {
      const parts = line.split("|");
      const projectNamePart = parts[0].trim();
      
      // Skip empty or bullet lines
      if (!projectNamePart || projectNamePart.startsWith("-") || projectNamePart.startsWith("•")) {
        i++;
        continue;
      }
      
      // Extract project name (remove leading bullets/dashes and dates)
      const nameMatch = projectNamePart.match(/^[\s•*-]*(.+?)(?:\s*\(\d+[-–]\d+\))?$/);
      const projectName = nameMatch ? nameMatch[1].trim() : projectNamePart;
      
      // Skip if too short or already seen
      if (projectName.length < 2 || seenNames.has(projectName.toLowerCase())) {
        i++;
        continue;
      }
      
      // Extract technologies (after "|")
      let techs: string[] = [];
      if (parts.length > 1) {
        const techPart = parts[1];
        techs = techPart
          .split(",")
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .slice(0, 10); // Max 10 techs per project
      }
      
      // Collect full description (next few lines until empty line or next project)
      const descriptionLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && descriptionLines.length < 10) {
        const nextLine = lines[j].trim();
        
        // Stop if empty line or new section/project
        if (!nextLine) break;
        if (/^(experience|education|skills|certifications|[A-Z][a-zA-Z\s]*[\s|—–])|^[^\s•*-]|^\d{4}/.test(nextLine)) break;
        
        // Include bullet points and description
        if (nextLine.startsWith("-") || nextLine.startsWith("•") || nextLine.startsWith("*")) {
          descriptionLines.push(nextLine);
        } else if (descriptionLines.length > 0) {
          // Include continuation lines after first bullet
          descriptionLines.push(nextLine);
        }
        
        j++;
      }
      
      const fullText = [line, ...descriptionLines].join("\n").trim();
      
      projects.push({
        name: projectName,
        tech: techs,
        fullText,
      });
      
      seenNames.add(projectName.toLowerCase());
      i = j;
      continue;
    }
    
    i++;
  }
  
  return projects;
}

/**
 * Filter projects based on user tech stack with fallback logic
 * 
 * Algorithm:
 * 1. Select ALL projects matching user tech stack (case-insensitive, partial match)
 * 2. If less than 2 projects matched, add additional top projects as fallback
 * 3. Always return at least 2 projects (if available) for question variety
 * 
 * @param projects - Array of projects from extractProjectsWithTech()
 * @param userTechStack - User's selected technologies (e.g., ["React", "Node.js"])
 * @returns Array with: [all matching projects, ...additional non-matching projects], minimum 2 total
 */
export function filterProjectsByTech(
  projects: { name: string; tech: string[]; fullText: string }[],
  userTechStack: string[]
): { name: string; tech: string[]; fullText: string }[] {
  
  if (!projects.length || !userTechStack.length) {
    // If no projects or empty tech stack, return top 2 projects as fallback
    return projects.slice(0, 2);
  }

  // Normalize user tech stack to lowercase for comparison
  const normalizedUserTech = userTechStack.map(t => t.toLowerCase().trim()).filter(t => t.length > 0);
  
  // Step 1: Filter projects with at least one matching tech
  const matchedProjects = projects.filter(project => {
    // Check if any project tech matches any user tech (case-insensitive, partial match)
    return project.tech.some(projectTech => {
      const normalizedProjectTech = projectTech.toLowerCase().trim();
      
      // Check for exact match or partial match
      return normalizedUserTech.some(userTech => {
        // Exact match
        if (normalizedProjectTech === userTech) return true;
        
        // Partial match - check if one contains the other
        // e.g., "react.js" matches "react", "node.js" matches "node"
        if (
          normalizedProjectTech.includes(userTech) ||
          userTech.includes(normalizedProjectTech)
        ) {
          // Avoid false positives - check it's a word boundary
          const regex = new RegExp(`\\b${escapeRegex(userTech)}\\b|${escapeRegex(userTech)}`, "i");
          const reversed = new RegExp(`\\b${escapeRegex(normalizedProjectTech)}\\b|${escapeRegex(normalizedProjectTech)}`, "i");
          return regex.test(normalizedProjectTech) || reversed.test(userTech);
        }
        
        return false;
      });
    });
  });
  
  // Step 2: If less than 2 matched projects, add additional top projects as fallback
  if (matchedProjects.length < 2) {
    // Get non-matched projects
    const matchedNames = new Set(matchedProjects.map(p => p.name.toLowerCase()));
    const nonMatchedProjects = projects.filter(p => !matchedNames.has(p.name.toLowerCase()));
    
    // Add non-matched projects until we have at least 2 total
    const additionalNeeded = 2 - matchedProjects.length;
    const fallbackProjects = nonMatchedProjects.slice(0, additionalNeeded);
    
    return [...matchedProjects, ...fallbackProjects];
  }
  
  // Step 3: Return matched projects (prioritize tech stack matches)
  return matchedProjects;
}
