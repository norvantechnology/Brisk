/**
 * One-off: send both Register Interest emails to a test inbox.
 * Usage: npx ts-node -r dotenv/config scripts/send-register-interest-test-emails.ts
 */
import {
  sendCustomerRegisterInterestEmail,
  sendTraderRegisterInterestEmail,
} from '../src/services/email.service';

const TO = process.env.TEST_EMAIL_TO || 'kavathiyajenish008@gmail.com';

async function main() {
  console.log(`Sending customer + trader Register Interest emails to ${TO}...`);

  await sendCustomerRegisterInterestEmail({
    fullName: 'Jenish Customer',
    email: TO,
  });
  console.log('✓ Customer waitlist email sent');

  await sendTraderRegisterInterestEmail({
    fullName: 'Jenish Trader',
    email: TO,
  });
  console.log('✓ Trader waitlist email sent');

  console.log('Done. Check inbox (and spam) for:');
  console.log('  - You’re on the BRISK Waitlist');
  console.log('  - You’re on the BRISK Trader Waitlist');
}

main().catch((err) => {
  console.error('Failed to send test emails:', err);
  process.exit(1);
});
