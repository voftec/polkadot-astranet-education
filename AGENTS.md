# Repo Guidelines for Contributors

## Code Style
- Indent with **2 spaces** for all files.
- Use modern JavaScript (ES6+) with modules.
- Keep functions short and use descriptive naming.
- Store JavaScript in `public/js/` and styles in `public/css/`.

## Commit Rules
- Commit directly to the default branch.
- Provide clear commit messages describing your change.

## Testing
- Run `npm test` from the repository root after any change and before committing.
- If the tests fail due to missing dependencies or network restrictions, note this in your PR description.

## Pull Request Notes
- Summarize the purpose of the PR and key changes.
- Include a short testing section with the result of `npm test`.
