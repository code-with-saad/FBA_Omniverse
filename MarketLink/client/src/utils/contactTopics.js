export const CONTACT_TOPICS = [
  { value: 'market_request', label: 'Request a new market' },
  { value: 'market_complaint', label: 'Complaint about a market' },
  { value: 'farmer_complaint', label: 'Complaint about a farmer' },
  { value: 'order_help', label: 'Help with an order' },
  { value: 'selling', label: 'Selling on MarketLink' },
  { value: 'feedback', label: 'Feedback or idea' },
  { value: 'other', label: 'Something else' },
];

export const topicLabel = (value) => CONTACT_TOPICS.find((x) => x.value === value)?.label || '';
