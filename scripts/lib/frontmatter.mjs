function fimDoFrontmatter(source) {
  const firstDivider = source.match(/^---\s*\r?$/m);
  if (!firstDivider || firstDivider.index !== 0) return null;

  const rest = source.slice(firstDivider[0].length);
  const closingDivider = rest.match(/^---\s*\r?$/m);
  return closingDivider ? rest.slice(0, closingDivider.index) : null;
}

export function valorFrontmatter(source, field) {
  const frontmatter = fimDoFrontmatter(source);
  if (frontmatter === null) return null;

  const fieldPattern = new RegExp(`^${field}:[ \\t]*`, "m");
  const match = frontmatter.match(fieldPattern);
  if (!match) return null;

  const value = frontmatter.slice(match.index + match[0].length);
  if (!value) return "";

  const quote = value[0];
  if (quote !== '"' && quote !== "'") return value.split(/\r?\n/, 1)[0].trim();

  let result = "";
  let escaped = false;
  for (let index = 1; index < value.length; index += 1) {
    const character = value[index];
    if (character === quote && !escaped) {
      return result.replace(/\r?\n[ \t]*/g, " ").trim();
    }
    result += character;
    escaped = character === "\\" && !escaped;
    if (character !== "\\") escaped = false;
  }

  return null;
}
