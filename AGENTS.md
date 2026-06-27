# Agent Instructions

Deploy every completed change to Vercel by default when it affects the site's or apps' frontend, backend, routes, assets, middleware, configuration, or runtime behavior.

Do not deploy housekeeping-only edits that do not affect the live site or apps, such as local handoff folders, zip files, notes, agent instruction files, gitignore-only changes for ignored local artifacts, or other repo-local documentation/metadata changes.

Other exceptions should be rare and explicit. Do not auto-deploy when the change is an overhaul-type change, destructive, knowingly broken, missing required secrets, or the user asks not to deploy. If deployment is skipped, say exactly why and what must happen before deploying.
