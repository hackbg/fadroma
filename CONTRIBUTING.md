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

### How Do I Submit A Bug Report?
After you have determined that the issue is present in the latest version of the default branch, create an issue and provide the following information:

- Use a **descriptive** title to identify the problem.
- Explain the **expected behavior**
- Describe the steps to **reproduce the problem** with as many details as necessary.
- When providing code samples, please use [code blocks](https://docs.github.com/en/github/writing-on-github/working-with-advanced-formatting/creating-and-highlighting-code-blocks)

### How Do I Submit An Enhancement Suggestion?
Similar to Bug reports. Please provide the following information:

- Use a **descriptive** title to identify the suggestion.
- Provider a **description of a suggested enhancement** in as many details as necessary.
- When providing code samples, please use [code blocks](https://docs.github.com/en/github/writing-on-github/working-with-advanced-formatting/creating-and-highlighting-code-blocks)

## Submitting Pull Requests
Instructions are similar to those for bug reports. Please provide the following
information:

- If this is not a trivial fix, consider **creating an issue to discuss first** and **later link to it from the PR**.
- Use a **descriptive title** for the pull request.
- Follow [Conventional Commit specification](https://www.conventionalcommits.org/en/v1.0.0/) where sufficiently large or impactful change is made.
- Provide a **description of the changes** in as many details as necessary.

## Reviewing Pull Requests
All PRs require at least one review approval before they can be merged. Each reviewer is responsible
for all checked items unless they have indicated otherwise by leaving their handle next to specific
items. In addition, use the following review explanations:

- `LGTM` without explicit approval means that the changes look good,
  but you haven't thoroughly reviewed all of the items.
- `Approval` means that you have completed the review. In addition, follow these guidelines:
    - Naming must be consistent with conventions and the rest of the codebase
    - Code must live in a reasonable location.
- If you are only making "surface level" reviews, submit any notes as `Comments` without adding a review.

## Committing code

### Prerequisites

You'll need:

* **Your preferred code editor.** We use NeoVim and VSCode.
* **Linux or macOS.** WSL might also work but we haven't really tested that much.
  (Whoever runs Fadroma on Plan 9 ascends.)
* **Git**, for keeping track of your changes.
* **Node.js, versions >= 16.12, and the [PNPM](https://pnpm.io) package manager**,
* At least one of the following:
  * **A Rust toolchain**, stable or nightly.
  * **Docker, configured to run without `sudo`.** Fadroma uses Docker to encapsulate builds
    (providing Rust 1.59 in the default build container) and to launch devnets (providing a
    local development environment).

### Submodule setup

Fadroma uses Git submodules in its development workflow,
and can itself be included as a submodule in your project:

To add Fadroma as Git submodule:

```sh
git submodule add -b refactor/x git@github.com:hackbg/fadroma.git
git submodule update --init --recursive
git commit -m "tabula rasa"
```

(Replacing `hackbg/fadroma` with the name of your fork)

> Read more about [Git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules)

### Sending pull requests

### Publishing packages

The TypeScript packages have been configured to use `@hackbg/ubik` for publishing.
Packages published using Ubik contain TS, ESM and CJS code side by side.
This is all because in 2022 TypeScript made the decision to generate invalid ESM modules
that Node 16+ would not consume. (Ubik "fixes it in post" by rewriting the `import` statements.)
The command to publish a package to NPM is `pnpm ubik wet`; to do a "dry run", use `pnpm ubik dry`.
