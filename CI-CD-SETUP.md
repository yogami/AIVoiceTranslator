# AIVoiceTranslator CI/CD Setup Guide

This guide provides detailed instructions for setting up the Continuous Integration and Continuous Deployment (CI/CD) pipeline for AIVoiceTranslator using GitHub Actions, triggered directly from Replit.

## One-Time Setup Process

### 1. Create a GitHub Repository

1. Go to [GitHub](https://github.com/) and sign in (or create an account if needed)
2. Click on the "+" icon in the top-right corner and select "New repository"
3. Name your repository (e.g., "AIVoiceTranslator")
4. Choose "Public" or "Private" visibility (CI/CD minutes are limited for private repos)
5. Click "Create repository"

### 2. Initialize Git in Replit and Push Code

Run these commands in the Replit Shell tab:

```bash
# Initialize Git (if not already done)
git init

# Add remote repository (replace with your GitHub username and repo name)
git remote add origin https://github.com/YOUR_USERNAME/AIVoiceTranslator.git

# Add all files
git add .

# Make initial commit
git commit -m "Initial commit"

# Push to GitHub
git push -u origin main
```

If prompted, enter your GitHub credentials.

### 3. Generate a GitHub Personal Access Token

1. On GitHub, go to your account settings (click your profile picture → Settings)
2. Scroll down to "Developer settings" and click on it
3. Click on "Personal access tokens" → "Tokens (classic)"
4. Click "Generate new token" → "Generate new token (classic)"
5. Give your token a name (e.g., "AIVoiceTranslator Replit Integration")
6. Select the "repo" scope to allow managing repositories
7. Click "Generate token"
8. Copy the token that appears (you won't be able to see it again!)

### 4. Add the GitHub Token to Replit Secrets

1. In Replit, go to the "Secrets" tool in the left sidebar (lock icon)
2. Add a new secret:
   - Key: `GITHUB_TOKEN`
   - Value: Paste the personal access token you generated
3. Click "Add Secret"

### 5. Update the CI/CD Trigger Script

Edit the `ci-cd-trigger.sh` file to include your GitHub username and repository name:

```bash
# Find these lines in ci-cd-trigger.sh
GITHUB_USERNAME="your-username"
REPO_NAME="AIVoiceTranslator"

# Replace with your actual GitHub username and repository name
GITHUB_USERNAME="actual-username"
REPO_NAME="actual-repo-name"
```

### 6. Make the Script Executable

```bash
chmod +x ci-cd-trigger.sh
```

## Running the CI/CD Pipeline

Once you've completed the setup, you can trigger the CI/CD pipeline at any time:

```bash
./ci-cd-trigger.sh
```

This will:
1. Push your latest code changes to GitHub
2. Trigger the GitHub Actions workflow
3. Run all tests in a clean environment
4. Provide a link to view the results

## Viewing Test Results

You can view the results of your CI/CD runs by:

1. Going to your GitHub repository
2. Clicking on the "Actions" tab
3. Selecting the most recent workflow run

This will show you detailed logs of all the tests that ran, any errors that occurred, and the overall status of the pipeline.

## Troubleshooting

If you encounter issues:

- **Permission errors**: Make sure your GitHub token has the correct permissions
- **Push failures**: Check if you need to pull changes first with `git pull origin main`
- **Workflow not running**: Verify the workflow file is in the correct location (`.github/workflows/ci-cd.yml`)
- **Webhook errors**: Ensure your repository's name and username are correct in the script

For more help, check the GitHub Actions documentation or open an issue in the repository.