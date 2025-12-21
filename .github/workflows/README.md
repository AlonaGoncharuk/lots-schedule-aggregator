# GitHub Actions Workflows Setup

This directory contains GitHub Actions workflows for CI/CD automation.

## Workflows

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every pull request to the `main` branch:
- Checks out code
- Sets up Node.js 20
- Installs dependencies
- Installs Playwright browsers
- Runs syntax check
- Runs unit tests
- Verifies Dockerfile exists

**Merge Protection**: To block merges when tests fail, enable branch protection rules in GitHub:
1. Go to Settings → Branches
2. Add rule for `main` branch
3. Enable "Require status checks to pass before merging"
4. Select "test" as required status check

### Deploy Workflow (`.github/workflows/deploy.yml`)

Runs on every push to the `main` branch:
- Runs all tests (blocks deployment if tests fail)
- Authenticates to Google Cloud Platform
- Builds and deploys to Cloud Run
- Provides deployment summary

## Required GitHub Secrets

The deployment workflow requires the following secrets to be configured in your GitHub repository:

### Setting up GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each secret below

### Required Secrets

#### `GCP_SA_KEY`
- **Description**: Service account JSON key for GCP authentication
- **How to create**:
  1. Go to [GCP Console](https://console.cloud.google.com/)
  2. Navigate to **IAM & Admin** → **Service Accounts**
  3. Click **Create Service Account**
  4. Name it (e.g., `github-actions-deploy`)
  5. Grant the following roles:
     - **Cloud Run Admin** (to deploy services)
     - **Service Account User** (to use service accounts)
     - **Storage Admin** (if using Cloud Build)
  6. Click **Done**
  7. Click on the created service account
  8. Go to **Keys** tab → **Add Key** → **Create new key**
  9. Select **JSON** format
  10. Download the JSON file
  11. Copy the entire contents of the JSON file
  12. Paste it as the value for `GCP_SA_KEY` secret in GitHub

#### `GCP_PROJECT_ID`
- **Description**: Your GCP project ID
- **Value**: `alona-first-project` (or your actual project ID)
- **How to find**: 
  - Go to GCP Console
  - The project ID is shown in the project selector at the top

#### `GCP_REGION` (Optional)
- **Description**: GCP region for Cloud Run deployment
- **Default**: `us-central1`
- **Value**: Your preferred region (e.g., `us-central1`, `us-east1`, `europe-west1`)

#### `GCP_SERVICE_NAME` (Optional)
- **Description**: Cloud Run service name
- **Default**: `lots-schedule-aggregator`
- **Value**: Your service name if different from default

## Testing the Setup

### Test CI Workflow
1. Create a new branch
2. Make a change
3. Create a pull request to `main`
4. Check the **Actions** tab to see the CI workflow run
5. Verify tests pass

### Test Deploy Workflow
1. Merge a pull request to `main` (or push directly to `main`)
2. Check the **Actions** tab to see the deploy workflow run
3. Verify deployment succeeds
4. Check your Cloud Run service to confirm the new version is deployed

## Troubleshooting

### Tests fail in CI
- Check the Actions logs for specific test failures
- Ensure all dependencies are listed in `package.json`
- Verify Node.js version matches (should be 20)

### Deployment fails
- Verify all GitHub secrets are set correctly
- Check that the service account has the required permissions
- Ensure the GCP project ID is correct
- Verify the region and service name are correct

### Authentication errors
- Verify `GCP_SA_KEY` contains valid JSON
- Ensure the service account has the required IAM roles
- Check that the service account key hasn't been revoked

## Security Notes

- Never commit service account keys or secrets to the repository
- Rotate service account keys periodically
- Use least-privilege principle for service account permissions
- Review GitHub Actions logs regularly for any exposed secrets

