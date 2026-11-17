// Deployment mode flag (build-time). Customer deployments - one
// Vercel project per hospital customer, per the deployment
// runbook - are built with VITE_CUSTOMER_DEPLOYMENT=true: the
// public marketing landing and the Request Demo page are replaced
// by the sign-in experience, because a customer's instance is a
// working training system, not a sales site (and its demo form
// would otherwise persist sales leads into the customer's own
// store; the API refuses them too - see api/sales/leads.js).
// Unset or any other value (the public nyxhicslab.com build)
// keeps the marketing site exactly as it is today.
export const IS_CUSTOMER_DEPLOYMENT =
  (import.meta.env.VITE_CUSTOMER_DEPLOYMENT as string | undefined) === 'true';
