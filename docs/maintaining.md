# Repository maintenance

## Main branch

The active [repository rules](https://github.com/jorgebaptista/matiz/rules) require:

- A pull request with the `check` job passing against the latest base branch.
- All review conversations resolved before merging.
- No force pushes, branch deletion or bypass actors, including administrators.

Approving reviews are optional while there is one maintainer. Outside contributors use forks and cannot merge. Merged branches are deleted automatically.

The policy is versioned in [main.ruleset.json](../.github/main.ruleset.json). Editing that file does not update GitHub automatically. To apply a reviewed change, find the ruleset ID, update it, then verify the effective rules:

```sh
gh api repos/jorgebaptista/matiz/rulesets
gh api --method PUT repos/jorgebaptista/matiz/rulesets/RULESET_ID --input .github/main.ruleset.json
gh api repos/jorgebaptista/matiz/rules/branches/main
```

Actions use a read-only token by default and cannot approve pull requests.

## Publish the website

Run **Publish playable website** from GitHub Actions on `main`. The [workflow](../.github/workflows/pages.yml) checks and builds the site, then deploys it to GitHub Pages. Merging a PR does not publish it.

For local preview:

```sh
npm run build:site
python -m http.server 8000 --directory site-dist
```

Open `http://localhost:8000`. After publishing, check the live site at phone width: start a round, switch language and open a shared challenge.

On a fork, enable GitHub Pages with **GitHub Actions** as its source. For another host, set `SITE_URL` to the final HTTPS root, including any project path, before building. This controls canonical URLs, sharing links and `sitemap.xml`, including links shared from offline and Android builds.

## Search metadata

Each edition's title and description come from its locale file. The site generates an edition page and sitemap entry for every playable pack.

For Google Search Console's HTML-tag verification, set the repository Actions variable `GOOGLE_SITE_VERIFICATION` to Google's content value and publish again. Complete verification in Search Console and submit `sitemap.xml`.
