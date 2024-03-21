# Contributing to Fadroma

A big welcome and thank you for considering contributing to Fadroma!

Reading and following these guidelines will help us make the contribution process
easy and effective for everyone involved. It also communicates that you agree to respect the
time of the developers managing and developing these open source projects.
In return, we will reciprocate that respect by addressing your issue,
assessing changes, and helping you finalize your pull requests.

When contributing to this repository, please first discuss the change you wish to make
via issue, email, or any other method with the owners of this repository before making a change.

Please note we have a code of conduct, please follow it in all your interactions with the project.

## Code of Conduct

Before contributing please read our [Code of Conduct](CODE_OF_CONDUCT.md) which
all contributors are expected to adhere to.

## Filing Issues

### Bug reports

After you have determined that the issue is present in the latest version of the default branch,
create an issue and provide the following information:

- Use a **descriptive** title to identify the problem.

- Explain the **expected behavior**

- Describe the steps to **reproduce the problem** with as many details as necessary.

- When providing code samples, please use [code blocks](https://docs.github.com/en/github/writing-on-github/working-with-advanced-formatting/creating-and-highlighting-code-blocks)

### Enhancement suggestions

Similar to bug reports. Please provide the following information:

- Use a **descriptive** title to identify the suggestion.

- Provide a **description of a suggested enhancement** in as many details as necessary.

- When providing code samples, please use [code blocks](https://docs.github.com/en/github/writing-on-github/working-with-advanced-formatting/creating-and-highlighting-code-blocks)

## Contributing code

Requirements:

* Git
* Node 18+
* Rust
* Docker (make sure you can call `docker` without `sudo`)

### Clone the repo recursively

If you have write access to the Fadroma repo:

```shell
git clone --recursive git@github.com:hackbg/fadroma.git # clone with submodules
```

External contributors that don't have write access to the repo
should instead [fork Fadroma](https://github.com/hackbg/fadroma/fork) and
clone from their fork's URL

```shell
git clone --recursive git@github.com:yourusername/fadroma.git # clone with submodules
```

* See also: [submitting pull requests](#submitting-pull-requests).

#### Update submodules

If you forget the `--recursive`, you can initialize the submodules with:

```shell
cd fadroma                              # enter repo
git submodule update --init --recursive # init git submodules
```

* You may also need to run this command after switching branches
  or other `git checkout` invocations that change the module pointer..

### Install Node dependencies

Fadroma's JS side is structured as a PNPM workspace. In recent versions of Node,
you should be able to enable PNPM with `corepack enable`. Alternatively, use `npm i -g pnpm`.

```shell
cd fadroma      # enter workspace
corepack enable # enable pnpm
pnpm i          # install dependencies
```

### Iterate

Now it's your time to shine. When implementing your contribution,
you can use the following commands to check for correctness:

```shell
pnpm check    # check types
pnpm test     # show list of tests
pnpm test all # run full test suite
pnpm cov all  # measure test coverage
```

* You can pass arguments to `pnpm test` and `pnpm cov` that allow you to narrow down the
  scope of tests you run. Fewer tests run faster, and depend on fewer external services

### Commit

```shell
git add .
git commit -m "feat(name): description"
```

* Longer commit messages are welcome.
* The preferred commit line format is roughly inspired by [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/),
  but does not conform to that specification.
* Some common prefixes are `feat`, `fix`, `break`, `refactor`, `chore`, `docs`, `wip`, `release`.
* Combine prefixes with `+`, e.g. `feat(devnet)+fix(agent): feature in devnet needed fix in agent`
* Version bumps should go in release commits e.g. `release(2.3.4,agent@2.1.2): bugfix in agent`
* When doing more than 1 thing in the same commit, try `git add -p .` to interactively
  separate sets of unrelated changes into separate commits.

To skip the pre-commit type check:

```shell
git commit --no-verify -m "feat(name): description"
```

* Skipping the pre-commit type check is not generally recommended.
  * It's allowed within a feature branch (as an escape hatch for saving unfinished work),
    since the branch will have to pass CI (incl. typecheck) before merge.
  * Also useful when you know you haven't changed any TS/JS code in your commit.
* The pre-commit check includes a `pnpm i` which may update one or more `pnpm-lock.yaml` files.
  Currently, these are not automatically added to the commit; use `git add ...` and
  `git commit --amend --no-verify --no-edit` to add them to the last commit.
* Avoid amending commits that are already pushed because you'll have to force push those,
  which makes submodules fragile.

### Release

First, update the `version` field in the `package.json` of the package that
you're releasing. If needed, update it in the `package.json` of dependent packages.

Then, make a release commit:

```sh
git add .
git commit -m "release(component@version): description"
```

To test if a package is fit for publishing, use a "dry run":

```sh
pnpm release --dry-run # test that package can be publshed
```

To publish a package, run this in the package directory:

```sh
pnpm release # publish package to npm
```

* Fadroma uses `@hackbg/ubik` to "fix in post" some drama around TypeScript and ESM extensions.

### More dev tips

#### Git workflow

#### Hacking from downstream

Should you need to hack on Fadroma in the context of an existing project,
it's easy to add it as a submodule:

```sh
git submodule add -b fix/something git@github.com:$YOURFORK/fadroma.git
git submodule update --init --recursive
git commit -m "added Fadroma as submodule"
```

TODO: Add this setup into `@fadroma/create`

#### Publishing docker image

When updating the base image (`FROM` line) in a Dockerfile (such as the base build Dockerfile,
or the devnet Dockerfiles), make sure to preserve the registry URL prefix and SHA256 digest
of the base image. In the spirit of reproducible builds, this prevents a hostile build
environment from potentially replacing base images with its own versions for "optimization"
purposes.

## Submitting Pull Requests

Instructions are similar to those for bug reports. Please provide the following
information:

- If this is not a trivial fix, consider **creating an issue to discuss first** and
  **later link to it from the PR**.

- Use a **descriptive title** for the pull request.

- Follow [Conventional Commit specification](https://www.conventionalcommits.org/en/v1.0.0/)
  where sufficiently large or impactful change is made.

- Provide a **description of the changes** in as many details as necessary.

- **Cool history doesn't change.** We prefer to avoid rebases,
  as they necessitate overwriting history. An exception is `git pull --rebase`.
  Still, feel free to use what is most appropriate.

## Reviewing Pull Requests

All PRs require at least one review approval before they can be merged. Each reviewer is
responsible for all checked items unless they have indicated otherwise by leaving their handle
next to specific items. In addition, use the following review explanations:

- `LGTM` without explicit approval means that the changes look good,
  but you haven't thoroughly reviewed all of the items.

- `Approval` means that you have completed the review. In addition, follow these guidelines:

    - Naming must be consistent with conventions and the rest of the codebase

    - Code must live in a reasonable location.

- If you are only making "surface level" reviews, submit any notes as `Comments`
  without adding a review.
