import useSeo from './useSeo';

/** Title for pages that are not meant for search engines (accounts, dashboards, basket, sign-in steps). */
export default function useDocumentTitle(title) {
  useSeo({ title, noindex: true });
}
