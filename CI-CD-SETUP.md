# GitHub CI/CD Setup Guide

To properly configure GitHub Actions for the AIVoiceTranslator project, follow these steps:

## 1. Add Required Secrets

Go to your GitHub repository Settings -> Secrets and variables -> Actions -> New repository secret and add the following secrets:

- `OPENAI_API_KEY`: Your OpenAI API key for the translation services
- `GITHUB_TOKEN`: This is automatically provided by GitHub Actions

## 2. Update Workflow Files (if needed)

If your tests require additional environment variables, modify the workflow files in `.github/workflows/` to include them.

## 3. Trigger CI/CD Pipeline

You can trigger the CI/CD pipeline by:

- Pushing changes to the main branch
- Manually triggering workflows from the "Actions" tab in GitHub

## 4. Connect Button Test

To specifically test the Connect button functionality:

1. Go to "Actions" tab in GitHub
2. Select "Connect Button WebSocket Test" workflow
3. Click "Run workflow" and select the main branch
4. Click the green "Run workflow" button

## Common Issues

- **Workflow Failures**: Check that all required secrets are properly set up
- **Missing Dependencies**: Ensure package.json includes all required dependencies
- **Environment Configuration**: Verify environment variables are correctly set in workflow files

## Verifying Results

After workflow runs complete, you can:

1. Check the "Actions" tab in GitHub to see workflow results
2. Download artifacts for detailed logs and test outputs
3. Only claim issues as fixed after relevant tests pass successfully in CI/CD

