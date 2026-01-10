#!/usr/bin/env node

/**
 * Helper script to get Vercel Organization ID and Project ID
 * 
 * Prerequisites:
 * 1. Install Vercel CLI: npm i -g vercel
 * 2. Login to Vercel: vercel login
 * 3. Link your project: vercel link
 * 
 * Usage:
 * node scripts/get-vercel-ids.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Getting Vercel Organization and Project IDs...\n');

try {
  // Check if Vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Vercel CLI not found. Please install it first:');
    console.error('   npm install -g vercel');
    console.error('   vercel login');
    process.exit(1);
  }

  // Check if project is linked
  const vercelDir = path.join(process.cwd(), '.vercel');
  if (!fs.existsSync(vercelDir)) {
    console.error('❌ Project not linked to Vercel. Please run:');
    console.error('   vercel link');
    process.exit(1);
  }

  // Read project.json to get IDs
  const projectJsonPath = path.join(vercelDir, 'project.json');
  if (!fs.existsSync(projectJsonPath)) {
    console.error('❌ Project configuration not found. Please run:');
    console.error('   vercel link');
    process.exit(1);
  }

  const projectConfig = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
  
  console.log('✅ Found Vercel configuration:');
  console.log(`   Organization ID: ${projectConfig.orgId}`);
  console.log(`   Project ID: ${projectConfig.projectId}`);
  console.log('');
  
  console.log('📋 GitHub Secrets to add:');
  console.log('   Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions');
  console.log('');
  console.log('   Add these secrets:');
  console.log(`   VERCEL_ORG_ID = ${projectConfig.orgId}`);
  console.log(`   VERCEL_PROJECT_ID = ${projectConfig.projectId}`);
  console.log('   VERCEL_TOKEN = [Get from https://vercel.com/account/tokens]');
  console.log('   NEXT_PUBLIC_SUPABASE_URL = [Your Supabase URL]');
  console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY = [Your Supabase Anon Key]');
  console.log('');
  
  console.log('🚀 Once secrets are added, push to main branch to trigger deployment!');

} catch (error) {
  console.error('❌ Error getting Vercel IDs:', error.message);
  console.error('');
  console.error('💡 Make sure you have:');
  console.error('   1. Installed Vercel CLI: npm i -g vercel');
  console.error('   2. Logged in: vercel login');
  console.error('   3. Linked project: vercel link');
  process.exit(1);
}