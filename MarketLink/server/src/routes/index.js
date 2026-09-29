import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authorize, loadFarmer, optionalAuth, protect, requireApprovedFarmer } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { ROLES } from '../utils/constants.js';

import * as auth from '../controllers/authController.js';
import * as tools from '../controllers/adminToolsController.js';
import * as stock from '../controllers/inventoryController.js';
import * as sales from '../controllers/salesController.js';
import * as moderation from '../controllers/moderationController.js';
import * as pub from '../controllers/publicController.js';
import * as markets from '../controllers/marketController.js';
import * as farmers from '../controllers/farmerController.js';
import * as products from '../controllers/productController.js';
import * as newsletter from '../controllers/newsletterController.js';
import * as faq from '../controllers/faqController.js';
import * as reviews from '../controllers/reviewController.js';
import * as orders from '../controllers/orderController.js';
import * as customer from '../controllers/customerController.js';
import * as notifications from '../controllers/notificationController.js';
import * as farm from '../controllers/farmerPortalController.js';
import * as admin from '../controllers/adminController.js';
import * as assistant from '../controllers/assistantController.js';
import * as banners from '../controllers/bannerController.js';
import * as issues from '../controllers/orderIssueController.js';
import * as attendance from '../controllers/attendanceController.js';
import * as urdu from '../controllers/urduController.js';
import { cached } from '../services/cache.js';

const router = Router();

// Brute-force protection: only failed logins count, so normal use is never blocked
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many failed attempts. Please try again in a few minutes.' },
});
// Spam protection for sign-up and contact forms
const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests. Please try again later.' } });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, message: { message: 'You are sending messages too quickly.' } });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many AI requests. Please wait a minute.' } });

const productImage = imageUpload('products', 6);
const productPhotos = productImage.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 4 }]); // main photo + up to 4 more
const farmerImages = imageUpload('farmers');
const marketImage = imageUpload('markets');
const categoryPhotos = imageUpload('categories').fields([{ name: 'icon', maxCount: 1 }, { name: 'image', maxCount: 1 }]); // round icon + wide card photo
const avatarImage = imageUpload('avatars');
const bannerImage = imageUpload('banners');

// ---------- Auth ----------
router.post('/auth/quick-account', formLimiter, auth.quickAccount); // checkout without an account
router.post('/auth/register', formLimiter, auth.registerCustomer);
router.post('/auth/register-farmer', formLimiter, auth.registerFarmer);
router.post('/auth/login', authLimiter, auth.login);
router.post('/auth/logout', auth.logout);
router.post('/auth/forgot-password', formLimiter, auth.forgotPassword);
router.post('/auth/reset-password', authLimiter, auth.resetPassword);
router.get('/auth/me', optionalAuth, auth.me);
router.put('/auth/me', protect, auth.updateMe);
router.put('/auth/password', protect, auth.changePassword);
router.put('/auth/avatar', protect, avatarImage.single('avatar'), auth.updateAvatar);
router.delete('/auth/avatar', protect, auth.removeAvatar);

// ---------- Public catalogue (optionalAuth adds favourite flags when logged in) ----------
router.get('/stats', cached(), pub.publicStats);
router.get('/categories', cached(), pub.listCategories);
router.get('/cities', cached(), tools.listCities);
router.get('/practices', cached(), pub.listPractices);
router.get('/search', pub.globalSearch);
router.get('/map', cached(), pub.mapData);
router.get('/testimonials', cached(), pub.testimonials);
router.get('/faqs', cached(), faq.listFaqs);
router.get('/announcements/active', optionalAuth, pub.activeAnnouncements);
router.get('/banners/home-offer', cached(), banners.getHomeOffer);
router.get('/credits', cached(600), pub.photoCredits);
router.post('/contact', formLimiter, pub.submitContact);
router.post('/newsletter', formLimiter, newsletter.subscribe);
router.post('/newsletter/unsubscribe', formLimiter, newsletter.unsubscribe);

router.get('/markets', cached(), markets.listMarkets);
router.get('/markets/:idOrSlug', optionalAuth, markets.getMarket);

router.get('/farmers', cached(), farmers.listFarmers);
router.get('/farmers/:idOrSlug', optionalAuth, farmers.getFarmer);
router.get('/farmers/:idOrSlug/availability', farmers.getFarmerAvailability);

router.get('/products', cached(30), products.listProducts);
router.get('/products/price-range', cached(), products.priceRange);
router.get('/products/:id', optionalAuth, products.getProduct);
router.post('/products/:id/remind', aiLimiter, optionalAuth, products.remindWhenAvailable); // "Remind me when available"
router.delete('/products/:id/remind', protect, products.cancelReminder);

router.get('/reviews', reviews.listReviews);
router.get('/reviews/eligible', protect, reviews.reviewEligibility);
router.post('/flags', protect, formLimiter, reviews.reportContent); // report a review, listing or stall
router.post('/assistant', chatLimiter, optionalAuth, assistant.chat);
router.post('/ai/urdu', aiLimiter, protect, authorize(ROLES.FARMER, ROLES.ADMIN), urdu.writeInUrdu); // "Write in Urdu" next to the Urdu boxes
router.post('/ai/write', aiLimiter, protect, tools.writeWithAi); // "Generate with AI" in text boxes (review replies, reviews, reasons, FAQs ...)
router.post('/ai/farm-bio', aiLimiter, tools.writeFarmBio); // "Generate with AI" for "About your farm" while signing up
router.get('/assistant/history', optionalAuth, assistant.history);
router.delete('/assistant/history', optionalAuth, assistant.clearHistory);

// ---------- Notifications (any logged-in user) ----------
router.get('/notifications', protect, notifications.listNotifications);
router.get('/notifications/unread-count', protect, notifications.unreadCount);
router.post('/notifications/read-all', protect, notifications.markAllRead);
router.post('/notifications/:id/read', protect, notifications.markRead);
router.delete('/notifications/:id', protect, notifications.deleteNotification);

// ---------- Customer ----------
const customerOnly = [protect, authorize(ROLES.CUSTOMER)];
router.get('/customer/dashboard', ...customerOnly, customer.customerDashboard);
router.get('/customer/favorites', ...customerOnly, customer.getFavorites);
router.post('/customer/favorites/:type/:id', ...customerOnly, customer.toggleFavorite);
router.get('/customer/family', ...customerOnly, customer.getFamily);
router.post('/customer/family', ...customerOnly, customer.addFamilyMember);
router.delete('/customer/family/:memberId', ...customerOnly, customer.removeFamilyMember);

router.post('/orders', ...customerOnly, orders.placeOrders);
router.get('/orders/my', ...customerOnly, orders.myOrders);
router.get('/orders/family', ...customerOnly, orders.familyOrders);
router.get('/orders/to-confirm', ...customerOnly, orders.ordersToConfirm);
router.post('/orders/:id/receipt', ...customerOnly, orders.confirmReceipt);
// "I did not receive it": a new pickup (customer, farmer or admin), "it was collected" (farmer), "got it after all" (customer)
router.post('/orders/:id/issue/new-pickup', protect, issues.arrangeNewPickup);
router.post('/orders/:id/issue/collected', protect, issues.farmerSaysCollected);
router.post('/orders/:id/issue/received', protect, issues.customerGotIt);
router.get('/orders/:id', protect, orders.getOrder);
router.put('/orders/:id', ...customerOnly, orders.modifyOrder);
router.post('/orders/:id/cancel', ...customerOnly, orders.cancelOrder);
router.get('/orders/:id/reorder', ...customerOnly, orders.reorderItems);
router.post('/reviews', ...customerOnly, reviews.createReview);
router.get('/reviews/mine', ...customerOnly, reviews.myReviews);
router.get('/customer/badges', ...customerOnly, reviews.customerBadges);

// ---------- Farmer ----------
const farmerOnly = [protect, authorize(ROLES.FARMER), loadFarmer];
const approvedFarmer = [...farmerOnly, requireApprovedFarmer];
router.get('/farmer/me', ...farmerOnly, farm.getMyFarm);
router.put('/farmer/profile', ...farmerOnly, farmerImages.fields([{ name: 'logo', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), farm.updateFarmProfile);
router.put('/farmer/pickup', ...approvedFarmer, farm.updatePickupSettings);
router.post('/farmer/away-today', ...approvedFarmer, farm.setAwayToday);
router.post('/farmer/market-day', ...approvedFarmer, farm.setMarketDay); // I'm at the market / I cannot come / undo
router.get('/farmer/insights', ...farmerOnly, farm.farmerInsights);

router.get('/farmer/products', ...farmerOnly, farm.myProducts);
router.post('/farmer/products/describe', ...approvedFarmer, tools.writeDescription); // "Write with AI"
router.post('/farmer/products/ai-seo', ...approvedFarmer, farm.aiProductSeo); // SEO + product schema written by AI
router.post('/farmer/products/:id/schema', ...approvedFarmer, farm.regenerateProductSchema);
router.post('/farmer/products', ...approvedFarmer, productPhotos, farm.createProduct);
router.put('/farmer/products/:id', ...approvedFarmer, productPhotos, farm.updateProduct);
router.patch('/farmer/products/:id/status', ...approvedFarmer, farm.setProductStatus);
router.patch('/farmer/products/:id/offer', ...approvedFarmer, farm.setProductOffer); // 20% off, 30% off ... or end the offer
router.delete('/farmer/products/:id', ...approvedFarmer, farm.deleteProduct);
router.put('/farmer/template', ...approvedFarmer, farm.updateTemplate);
router.post('/farmer/template/apply', ...approvedFarmer, farm.applyTemplateNow);

router.get('/farmer/orders', ...farmerOnly, farm.farmerOrders);
router.post('/farmer/orders/:id/:action', ...approvedFarmer, farm.updateOrderStatus);
router.get('/farmer/reviews', ...farmerOnly, farm.farmerReviews);
router.get('/farmer/badges', ...farmerOnly, stock.farmerBadges);
router.post('/farmer/describe', ...farmerOnly, tools.writeFarmBio); // "Generate with AI" for About your farm
router.get('/farmer/inventory', ...approvedFarmer, stock.inventory);
router.get('/farmer/inventory/movements', ...approvedFarmer, stock.movements);
router.post('/farmer/inventory/:id/adjust', ...approvedFarmer, stock.adjustStock);
router.put('/farmer/inventory/:id/threshold', ...approvedFarmer, stock.setThreshold);
router.get('/farmer/reports/sales', ...approvedFarmer, sales.salesReport);
router.post('/farmer/reviews/:id/respond', ...farmerOnly, farm.respondToReview);

// ---------- Admin ----------
const adminOnly = [protect, authorize(ROLES.ADMIN)];
router.get('/admin/order-issues', ...adminOnly, issues.listIssues); // pickup problems
router.get('/admin/attendance', ...adminOnly, attendance.attendanceReport); // who came to the market and who did not (with the reason)
router.post('/orders/:id/issue/resolve', ...adminOnly, issues.resolveIssue);
router.get('/admin/dashboard', ...adminOnly, admin.adminDashboard);
router.get('/admin/badges', ...adminOnly, admin.adminBadges);
router.get('/admin/filter-options', ...adminOnly, tools.filterOptions);
router.get('/admin/farmer-rankings', ...adminOnly, tools.farmerRankings);
router.post('/admin/tables/:name', ...adminOnly, tools.dataTable); // DataTables server-side processing
router.delete('/admin/subscribers/:id', ...adminOnly, newsletter.deleteSubscriber);
router.post('/admin/products/describe', ...adminOnly, tools.writeDescription);
router.post('/admin/farmers', ...adminOnly, tools.createFarmerAccount);
router.post('/admin/customers', ...adminOnly, tools.createCustomerAccount);
router.get('/admin/customers/:id/overview', ...adminOnly, tools.customerOverview);
router.get('/admin/order-options', ...adminOnly, tools.orderOptions);
router.post('/admin/orders', ...adminOnly, tools.adminPlaceOrder);
router.get('/admin/analytics/purchases', ...adminOnly, tools.purchaseAnalytics);
router.get('/admin/cities', ...adminOnly, tools.adminCities);
router.post('/admin/cities', ...adminOnly, tools.createCity);
router.put('/admin/cities/:id', ...adminOnly, tools.updateCity);
router.delete('/admin/cities/:id', ...adminOnly, tools.deleteCity);
router.get('/admin/farmers', ...adminOnly, admin.adminFarmers);
router.patch('/admin/farmers/:id/status', ...adminOnly, admin.setFarmerStatus);
router.get('/admin/customers', ...adminOnly, admin.adminCustomers);
router.patch('/admin/customers/:id/status', ...adminOnly, admin.setCustomerStatus);

router.get('/admin/markets', ...adminOnly, admin.adminMarkets);
router.post('/admin/markets', ...adminOnly, marketImage.single('image'), admin.createMarket);
router.put('/admin/markets/:id', ...adminOnly, marketImage.single('image'), admin.updateMarket);
router.delete('/admin/markets/:id', ...adminOnly, admin.deleteMarket);

router.get('/admin/products', ...adminOnly, admin.adminProducts);
router.patch('/admin/products/:id/moderate', ...adminOnly, admin.moderateProduct);
router.get('/admin/reviews', ...adminOnly, admin.adminReviews);
router.patch('/admin/reviews/:id/moderate', ...adminOnly, admin.moderateReview);
router.get('/admin/moderation/summary', ...adminOnly, moderation.moderationSummary);
router.patch('/admin/moderation/:id', ...adminOnly, moderation.resolveFlag);
router.post('/admin/farmers/describe', ...adminOnly, tools.writeFarmBio);

router.get('/admin/categories', ...adminOnly, admin.adminCategories);
router.post('/admin/categories', ...adminOnly, categoryPhotos, admin.createCategory);
router.put('/admin/categories/:id', ...adminOnly, categoryPhotos, admin.updateCategory);
router.delete('/admin/categories/:id', ...adminOnly, admin.deleteCategory);

router.put('/admin/banners/home-offer', ...adminOnly, bannerImage.single('image'), banners.updateHomeOffer);
router.get('/admin/announcements', ...adminOnly, admin.adminAnnouncements);
router.post('/admin/announcements', ...adminOnly, admin.createAnnouncement);
router.put('/admin/announcements/:id', ...adminOnly, admin.updateAnnouncement);
router.delete('/admin/announcements/:id', ...adminOnly, admin.deleteAnnouncement);

router.get('/admin/faqs', ...adminOnly, faq.adminFaqs);
router.post('/admin/faqs', ...adminOnly, faq.createFaq);
router.put('/admin/faqs/:id', ...adminOnly, faq.updateFaq);
router.delete('/admin/faqs/:id', ...adminOnly, faq.deleteFaq);

router.get('/admin/reports', ...adminOnly, admin.listReports);
router.get('/admin/reports/all', ...adminOnly, cached(120, 'admin'), admin.allReports); // every report for one period (the reports page)
router.post('/admin/reports', ...adminOnly, admin.generateReport);
router.get('/admin/reports/:id', ...adminOnly, admin.getReport);
router.delete('/admin/reports/:id', ...adminOnly, admin.deleteReport);

router.get('/admin/orders', ...adminOnly, admin.adminOrders);
router.get('/admin/messages', ...adminOnly, admin.adminMessages);
router.patch('/admin/messages/:id', ...adminOnly, admin.updateMessage);
router.delete('/admin/messages/:id', ...adminOnly, admin.deleteMessage);

export default router;
