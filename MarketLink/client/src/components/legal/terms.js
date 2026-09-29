import { CONTACT, TEAM_NAME } from '../../config';
import { isUrdu } from '../../i18n';
import { TERMS_SECTIONS_UR } from './terms.ur';

export const TERMS_UPDATED = '24 September 2026';

/** The date and sections in the language in use. */
export const termsUpdated = () => (isUrdu() ? '24 ستمبر 2026' : TERMS_UPDATED);
export const termsSections = () => (isUrdu() ? TERMS_SECTIONS_UR : TERMS_SECTIONS);

/**
 * MarketLink Terms & Conditions (shown on /terms and in the sign-up dialog).
 * Each section has a short title, an icon and paragraphs or bullet lists.
 */
export const TERMS_SECTIONS = [
  {
    id: 'about',
    icon: 'bi-info-circle',
    title: 'About these terms',
    body: [
      `MarketLink (theme: eGreen Basket) is a website created by ${TEAM_NAME} that connects local farmers markets with the people who shop there. Farmers publish their weekly stock and pickup times, and customers pre-order produce and collect it at the market.`,
      'By creating an account or using MarketLink you agree to these terms. If you do not agree, please do not create an account.',
    ],
  },
  {
    id: 'account',
    icon: 'bi-person-check',
    title: 'Your account',
    list: [
      'Give your real name, contact number, e-mail and address, and keep them up to date.',
      'Keep your password private. You are responsible for everything done with your account.',
      'One account per person. If you add family members to your household, you are responsible for the pre-orders they place.',
      'You must be at least 18 years old, or use MarketLink with the permission of a parent or guardian.',
    ],
  },
  {
    id: 'preorders',
    icon: 'bi-basket2',
    title: 'Pre-orders and pickup',
    list: [
      'A pre-order reserves the farmer’s stock for you. It is confirmed when the farmer accepts it.',
      'Pick a pickup date and time slot inside the farmer’s pickup windows. Please arrive during your slot and show your order number at the stall.',
      'A farmer may decline a pre-order (for example after a poor harvest). You will see the reason and the stock is released.',
      'MarketLink is pickup only. There is no home delivery.',
    ],
  },
  {
    id: 'changes',
    icon: 'bi-arrow-repeat',
    title: 'Changes and cancellations',
    list: [
      'You can change the items, the quantity or the pickup slot, or cancel, until the farmer’s order cut-off time shown at checkout.',
      'After the cut-off, contact the farmer directly using the details on your order.',
      'If you cannot come, please cancel so the produce can go to someone else. Accounts that often miss pickups may be deactivated.',
    ],
  },
  {
    id: 'payment',
    icon: 'bi-cash-coin',
    title: 'Prices and payment',
    list: [
      'Prices are set by the farmers, shown in Pakistani rupees (Rs) per unit.',
      'The price shown when you place the pre-order is the price you pay, even if the farmer changes it later.',
      'MarketLink does not take online payments. You pay the farmer in person when you collect your order.',
    ],
  },
  {
    id: 'farmers',
    icon: 'bi-shop',
    title: 'For farmers and stall owners',
    list: [
      'New stalls are checked and approved by a MarketLink administrator before their products are shown.',
      'List only produce you grow or make yourself, with honest names, photos, prices, units and stock.',
      'Keep your weekly stock, market days, pickup windows and closed dates up to date, and prepare every pre-order you accept.',
      'Follow food safety and hygiene rules and any rules of the markets where you sell.',
      'Listings that break these terms can be removed and the stall can be suspended.',
    ],
  },
  {
    id: 'reviews',
    icon: 'bi-star',
    title: 'Reviews and fair use',
    list: [
      'Reviews can be written after a completed pickup. Keep them honest and about the product or the farmer.',
      'No abusive, false or misleading content, spam or advertising, and no attempts to misuse or break the website.',
      'Administrators may remove reviews and listings that break these rules.',
    ],
  },
  {
    id: 'assistant',
    icon: 'bi-robot',
    title: 'The AI assistant',
    body: [
      'The assistant answers questions using live MarketLink data, such as market timings, stock and pickup windows. It can make mistakes, so please check the product or farmer page before you order.',
      'When you are signed in, your chat and what the assistant remembers (for example your city) are saved to your account. You can clear them at any time with “Clear chat”.',
    ],
  },
  {
    id: 'privacy',
    icon: 'bi-shield-lock',
    title: 'Privacy and your data',
    list: [
      'We store the details you give us, your pre-orders, favourites, reviews, notifications and assistant chat, only to run MarketLink.',
      'When you place a pre-order, the farmer sees your name, contact number and pickup details so they can prepare it.',
      'Your data is never sold. Passwords are stored encrypted.',
      'We use one login cookie to keep you signed in. Your basket is kept in your own browser.',
      'You can update your details on your profile, and ask us to delete your account through the Contact page.',
    ],
  },
  {
    id: 'responsibility',
    icon: 'bi-flower1',
    title: 'Responsibility',
    body: [
      'Farmers are responsible for the quality and safety of the produce they sell. Market days and times can change (for example because of weather or holidays); announcements and farmer closed dates are shown on the website.',
      'We work to keep MarketLink available and accurate, but we cannot promise that it will always be free of errors or interruptions.',
    ],
  },
  {
    id: 'updates',
    icon: 'bi-journal-text',
    title: 'Changes to these terms',
    body: ['We may update these terms. Important changes are announced on the website. Using MarketLink after a change means you accept the new terms.'],
  },
  {
    id: 'contact',
    icon: 'bi-envelope',
    title: 'Contact',
    body: [`Questions about these terms? Write to ${CONTACT.email}, call ${CONTACT.phone} or visit us at ${CONTACT.address}.`],
  },
];
