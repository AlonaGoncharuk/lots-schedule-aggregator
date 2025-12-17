#!/bin/bash

# Deployment script for GCP Cloud Run
# Usage: ./deploy.sh [service-name]

set -e

# Configuration
PROJECT_ID="alona-first-project"
REGION="us-central1"
SERVICE_NAME="${1:-lots-schedule-aggregator}"

echo "🚀 Deploying to GCP Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Set the GCP project
echo "📋 Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and deploy to Cloud Run
echo "🏗️  Building and deploying container..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 540 \
  --max-instances 10

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Getting service URL..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')
echo "🌐 Your service is available at: $SERVICE_URL"
echo ""
echo "💡 To view logs, run:"
echo "   gcloud run services logs read $SERVICE_NAME --region $REGION"

