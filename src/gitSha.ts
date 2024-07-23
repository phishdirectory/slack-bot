export function getGitSha() {
  // parse the git sha from the .git folder
  // revision = require('child_process')
  // .execSync('git rev-parse HEAD')
  // .toString().trim()
  // do that in typescript

  const revision = require("child_process")
    .execSync("git rev-parse HEAD")
    .toString()
    .trim()
    .slice(0, 7);

  return revision;
}
