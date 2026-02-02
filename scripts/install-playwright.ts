import { execSync } from 'child_process'
import path from 'path'

console.log('📦 Installing Playwright browsers...')

try {
  // Install playwright browsers
  execSync('npx playwright install chromium --with-deps', {
    stdio: 'inherit',
    cwd: process.cwd(),
  })

  console.log('✅ Playwright browsers installed successfully!')
  console.log('📝 Note: This should be run after npm/yarn install')
} catch (error) {
  console.error('❌ Failed to install Playwright browsers:', error)
  process.exit(1)
}
