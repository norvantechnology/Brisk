# Project Rules & Customizations

- **Third-Party Credentials & Integrations**: Always ask the user for confirmation and credentials before writing code that integrates with real third-party service providers (such as AWS SNS/Twilio, Firebase Cloud Messaging, Stripe keys, Apple/Google OAuth). If keys are needed, ask the user to request them from their client. Otherwise, use mock implementations for local testing.
