# Making Matiz public

## Build and check the site

Run `npm ci` and `npm run build:site`. Serve `site-dist` with `python -m http.server 8000 --directory site-dist` and open `http://localhost:8000`. Try the round on a phone and expand the sample question on the home page. The standalone offline game still builds into `dist/index.html`.

The Portuguese home page explains the game in plain HTML. Each pack has a direct play link, and the repository points people towards the word, language and feature forms. The search terms we target are *jogo de sinónimos em português europeu*, *enriquecer o vocabulário em português* and, in the repository, *open-source vocabulary game for native speakers*. These are descriptions of what players can do. Search demand and ranking remain unmeasured.

## Launch when ready

1. Merge the reviewed contribution and game changes onto the default branch. Check repository history, release attachments and credits for public distribution. Keep Android test builds clearly marked.
2. Make the repository public and enable GitHub Actions as the Pages source in **Settings → Pages**. Run **Publish playable website** manually on the default branch. The workflow builds the site with the Pages URL and publishes it. A custom domain is optional. [GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
3. Open the deployed URL signed out on a phone. Start a round, follow the contribution link, and check that sharing the home page shows the Matiz card. Set the repository About website and add a prominent play link to the README using the confirmed live URL. The build uses `SITE_URL` for the canonical URLs, absolute sharing metadata and `sitemap.xml`. On another static host, set it to the final HTTPS project root, including its path.
4. Verify the exact site prefix in Google Search Console, submit its sitemap and inspect the home page. For the HTML meta-tag verification method, save Google's content value in the repository Actions variable `GOOGLE_SITE_VERIFICATION`, run the manual Pages workflow again, then complete verification. After indexing, inspect actual queries, impressions and clicks for the Portuguese landing page before changing titles. Indexing and rankings are Google's decisions. [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) · [Request indexing](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)

## Where to share it

Start with a few Portuguese readers who can play one round on a phone. Ask which word they would use in a real conversation and whether two answers felt equally valid. A link straight to the playable game gives them something concrete to react to.

For the first community post, devPT explicitly welcomes personal projects. Choose the appropriate project-sharing channel, give the PT-PT play link and show one real question. Ask for Portuguese wording feedback and link to the language-pack guide for people who want to contribute another variety. [devPT](https://devpt.co/)

For a later Show HN, link directly to a working game. Explain in your own words why you wanted a vocabulary game in a language you already speak and what you learned from building it. The language-pack guide gives interested developers a specific way to join. Check their posting guidance at the time. [Show HN guidelines](https://news.ycombinator.com/showhn.html)

At launch, track two things separately: whether people find the game in search, and whether a new contributor can submit a playable pack using the guide. The first outside pack PR is a good occasion to revise the instructions.
