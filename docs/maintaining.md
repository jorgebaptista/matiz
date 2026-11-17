# Repository maintenance

## Main branch

The active [repository rules](https://github.com/jorgebaptista/matiz/rules) require:

- A pull request with the `check` job passing against the latest base branch.
- All review conversations resolved before merging.
- No force pushes, branch deletion or bypass actors, including administrators.

An approving review is optional while there is one maintainer: GitHub does not let authors approve their own PRs. Outside contributors use forks and cannot merge. Revisit this setting when more maintainers join. Merged branches are deleted automatically.

The policy is versioned in [main.ruleset.json](../.github/main.ruleset.json). Editing that file does not update GitHub automatically. To apply a reviewed change, find the ruleset ID, update it, then verify the effective rules:

```sh
gh api repos/jorgebaptista/matiz/rulesets
gh api --method PUT repos/jorgebaptista/matiz/rulesets/RULESET_ID --input .github/main.ruleset.json
gh api repos/jorgebaptista/matiz/rules/branches/main
```

Actions use a read-only token by default and cannot approve pull requests. Website publication is manual; see the [launch guide](launch.md).
