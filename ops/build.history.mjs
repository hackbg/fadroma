/** FIXME: fetching commits from history into a temporary checkout should happen outside of the container. */

function prepareHistory () {
  if (!context.git) throw new Error("please install git")
  log(`Compiling from checkout of ${sourceRef}`)
  // This works by using ".git" (or "../???/.git/modules/something") as a remote
  // and cloning from it. Since we may need to modify that directory,
  // we'll make a copy. This may be slow if ".git" is huge
  // (but at least it's not the entire working tree with node_modules etc)
  time(`cp -rT "${gitRoot}" "${tmpGit}"`)
  gitRoot = tmpGit
  // Helper functions to run with ".git" in a non-default location.
  const gitDir  = resolve(gitRoot, gitSubdir)
  const gitRun  = command => run(`GIT_DIR=${gitDir} git --no-pager ${command}`)
  const gitCall = command => call(`GIT_DIR=${gitDir} git --no-pager ${command}`)
  // Make this a bare checkout by removing the path to the working tree from the config.
  // We can't use "config --local --unset core.worktree" - since the working tree path
  // does not exist, git command invocations fail with "no such file or directory".
  const gitConfigPath = resolve(gitDir, 'config')
  let gitConfig = readFileSync(gitConfigPath, 'utf8')
  gitConfig = gitConfig.replace(/\s+worktree.*/g, '')
  writeFileSync(gitConfigPath, gitConfig, 'utf8')
  try {
    // Make sure that .refs/heads/${ref} exists in the git history dir,
    // (it will exist if the branch has been previously checked out).
    // This is necessary to be able to clone that branch from the history dir -
    // "git clone" only looks in the repo's refs, not the repo's remotes' refs
    gitRun(`show-ref --verify --quiet refs/heads/${sourceRef}`)
  } catch (e) {
    // If the branch is not checked out, but is fetched, do a "fake checkout":
    // create a ref under refs/heads pointing to that branch.
    if (noFetch) {
      console.error(`${sourceRef} is not checked out or fetched. Run "git fetch" to update.`)
      exit(1)
    } else {
      try {
        warn(`${sourceRef} is not checked out. Creating branch ref from ${gitRemote}/${sourceRef}\n.`)
        gitRun(`fetch origin --recurse-submodules ${sourceRef}`)
      } catch (e) {
        warn(`${sourceRef}: failed to fetch: ${e.message}`)
      }
      const shown     = gitCall(`show-ref --verify refs/remotes/${gitRemote}/${sourceRef}`)
      const remoteRef = shown.split(' ')[0]
      const refPath   = resolve(`${gitDir}/refs/heads/`, sourceRef)
      mkdirSync(dirname(refPath), { recursive: true })
      writeFileSync(refPath, remoteRef, 'utf8')
      gitRun(`show-ref --verify --quiet refs/heads/${sourceRef}`)
    }
  }
  // Clone from the temporary local remote into the temporary working tree
  git(`clone --recursive -b ${sourceRef} ${gitDir} ${buildRoot}`)
  chdir(buildRoot)
  // Report which commit we're building and what it looks like
  git(`log -1`)
  lookAround('.')
  log()
  // Clone submodules
  log(`Populating Git submodules...`)
  git(`submodule update --init --recursive`)
  chdir(srcSubdir)
}
