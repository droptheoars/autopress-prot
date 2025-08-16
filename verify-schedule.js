#!/usr/bin/env node
/**
 * SCHEDULE VERIFICATION TOOL
 * Verifies that your GitHub Actions will run every 2 minutes as expected
 */

function verifySchedule() {
  console.log('🕐 SCHEDULE VERIFICATION TOOL');
  console.log('=' .repeat(50));
  
  // Parse the cron expression: '*/2 4-21 * * 1-5'
  const cronExpression = '*/2 4-21 * * 1-5';
  console.log(`\n📋 Cron Expression: ${cronExpression}`);
  console.log('   • */2     = Every 2 minutes');
  console.log('   • 4-21    = Hours 4-21 UTC (covers 6am-11:59pm Norwegian)');
  console.log('   • *       = Every day of month');
  console.log('   • *       = Every month');
  console.log('   • 1-5     = Monday to Friday');
  
  // Current time analysis
  const now = new Date();
  const utcHour = now.getUTCHours();
  const norwegianTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Oslo' });
  const norwegianHour = parseInt(new Date().toLocaleString('en-US', { 
    timeZone: 'Europe/Oslo', 
    hour: '2-digit', 
    hour12: false 
  }));
  const dayOfWeek = now.getUTCDay(); // 0=Sunday, 1=Monday, etc.
  
  console.log(`\n🌍 Current Time Analysis:`);
  console.log(`   UTC Time: ${now.toISOString()}`);
  console.log(`   UTC Hour: ${utcHour}`);
  console.log(`   Norwegian Time: ${norwegianTime}`);
  console.log(`   Norwegian Hour: ${norwegianHour}`);
  console.log(`   Day of Week: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
  
  // Check if currently within schedule
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isWithinUTCHours = utcHour >= 4 && utcHour <= 21;
  const isWithinNorwegianHours = norwegianHour >= 6 && norwegianHour < 24;
  const shouldBeRunning = isWeekday && isWithinUTCHours && isWithinNorwegianHours;
  
  console.log(`\n✅ Schedule Status Check:`);
  console.log(`   Is Weekday (Mon-Fri): ${isWeekday ? '✅ YES' : '❌ NO'}`);
  console.log(`   UTC Hours 4-21: ${isWithinUTCHours ? '✅ YES' : '❌ NO'}`);
  console.log(`   Norwegian Hours 6-23: ${isWithinNorwegianHours ? '✅ YES' : '❌ NO'}`);
  console.log(`   Should Be Running: ${shouldBeRunning ? '🟢 YES' : '🔴 NO'}`);
  
  // Calculate next few run times
  console.log(`\n⏰ Next Run Times (if currently active):`);
  const currentMinute = now.getUTCMinutes();
  const nextEvenMinute = Math.ceil(currentMinute / 2) * 2;
  
  for (let i = 0; i < 6; i++) {
    const nextRun = new Date(now);
    nextRun.setUTCMinutes(nextEvenMinute + (i * 2));
    nextRun.setUTCSeconds(0);
    nextRun.setUTCMilliseconds(0);
    
    const norwegianNextRun = nextRun.toLocaleString('en-US', { 
      timeZone: 'Europe/Oslo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    console.log(`   ${i + 1}. ${nextRun.toISOString().substring(11, 16)} UTC (${norwegianNextRun} Norwegian)`);
  }
  
  // Instructions for verification
  console.log(`\n📖 HOW TO VERIFY ON GITHUB:`);
  console.log(`   1. Go to: https://github.com/[your-username]/euronext-webflow-automation`);
  console.log(`   2. Click the "Actions" tab`);
  console.log(`   3. Look for "Euronext Press Release Scraper" workflow`);
  console.log(`   4. Check recent runs - should see runs every 2 minutes during schedule`);
  console.log(`   5. Click on any run to see logs and timing`);
  
  console.log(`\n🔍 WHAT TO LOOK FOR:`);
  console.log(`   • Green checkmarks for successful runs`);
  console.log(`   • Runs spaced exactly 2 minutes apart`);
  console.log(`   • "Within scheduled hours" or "Outside scheduled hours" messages`);
  console.log(`   • No runs on weekends or outside 6am-11:59pm Norwegian time`);
  
  // GitHub CLI command (if available)
  console.log(`\n💻 GitHub CLI Commands (if you have 'gh' installed):`);
  console.log(`   gh run list --workflow="scraper.yml" --limit=10`);
  console.log(`   gh run view [run-id] --log`);
  
  return {
    cronExpression,
    currentlyActive: shouldBeRunning,
    norwegianTime,
    nextRunTime: nextEvenMinute
  };
}

// Run verification
const result = verifySchedule();

export { verifySchedule };