/** Public absolute API base for mobile WebView links. */
export const getPublicApiBaseUrl = () =>
  (
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_API_BASE_URL ||
    'https://brisk-aclm.onrender.com'
  ).replace(/\/$/, '');

/**
 * Profile → Support & Legal WebView URLs (dynamic from API host).
 * Help Center / Terms / Privacy open these in an in-app WebView.
 */
export const getSupportWebviewLinks = () => {
  const base = getPublicApiBaseUrl();
  return [
    {
      key: 'helpCenter',
      title: 'Help Center',
      url: `${base}/cms/help/html`,
    },
    {
      key: 'termsOfService',
      title: 'Terms of Service',
      url: `${base}/cms/legal/terms-and-conditions/html`,
    },
    {
      key: 'privacyPolicy',
      title: 'Privacy Policy',
      url: `${base}/cms/legal/privacy-policy/html`,
    },
  ];
};
