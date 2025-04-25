# Trunk-Based Development Guidelines

## Overview

This project uses trunk-based development practices to maintain a stable, high-quality codebase. Trunk-based development is a source-control branching model where developers collaborate on code in a single branch called 'trunk' (in our case, the 'main' branch), and avoid long-lived feature branches by integrating changes frequently.

## Key Principles

1. **Small, Frequent Commits**: Make small, focused changes and commit them frequently.
2. **Main Branch Always Deployable**: The main branch should always be in a stable, deployable state.
3. **Test Before Committing**: All changes must be thoroughly tested before being committed.
4. **Automated Testing**: CI/CD runs automated tests on every commit to verify the stability.

## Development Workflow

### 1. Make a Small Change

- Work on a single task, bug fix, or small feature.
- Keep changes focused and minimal.
- Follow the Single Responsibility Principle.

### 2. Test Thoroughly

Before committing:
- Run unit tests: `npm test -- --testPathPattern=tests/unit`
- Run integration tests: `npm test -- --testPathPattern=tests/integration`
- Run end-to-end tests (if applicable): `npm test -- --testPathPattern=tests/e2e`
- Run audio tests (if applicable): `npm test -- --testPathPattern=tests/audio`
- Perform manual testing as needed

### 3. Commit to Main

- Use descriptive commit messages with a consistent format:
  ```
  [type]: short description

  More detailed explanation if needed
  ```
  Where type is one of: feat, fix, docs, style, refactor, test, chore

- Examples:
  ```
  [feat]: add German language support
  
  Added German language option to the dropdown and included
  translations for all interface elements.
  ```
  
  ```
  [fix]: resolve WebSocket connection issue on Safari
  
  Fixed race condition in WebSocket connection that was causing
  failures specifically in Safari browsers.
  ```

### 4. Push to GitHub

- Push your changes immediately after committing.
- GitHub Actions will automatically run the CI/CD pipeline.
- Monitor the pipeline to ensure all tests pass.

### 5. Address CI Failures Immediately

If CI tests fail:
- Fix the issue immediately or revert your changes.
- The main branch should never remain in a broken state.

## Benefits of This Approach

- **Rapid Feedback**: Quickly identify and fix issues.
- **Reduced Merge Conflicts**: Frequent integration means fewer conflicts.
- **Simple Rollback**: Easy to revert problematic changes when they're small.
- **Better Visibility**: Clear history of incremental changes.
- **Improved Team Coordination**: Everyone works from the latest version.

## Troubleshooting

### If You Need to Roll Back a Change

```bash
# Revert the most recent commit
git revert HEAD

# Revert a specific commit
git revert [commit-hash]

# Push the revert
git push
```

### If You Need to Fix a Bug in Production

1. Create a fix and test thoroughly.
2. Commit directly to main with a `[fix]` prefix.
3. Push immediately.
4. CI/CD will deploy the fix automatically after tests pass.