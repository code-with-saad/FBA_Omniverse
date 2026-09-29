import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/layout/PublicLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import ApprovedFarmerRoute from './components/common/ApprovedFarmerRoute';
import ScrollToTop from './components/common/ScrollToTop';
import { PageLoader } from './components/common/Loader';

const Home = lazy(() => import('./pages/public/Home'));
const Products = lazy(() => import('./pages/public/Products'));
const BestSellers = lazy(() => import('./pages/public/BestSellers'));
const PhotoCredits = lazy(() => import('./pages/public/PhotoCredits'));
const Categories = lazy(() => import('./pages/public/Categories'));
const ProductDetail = lazy(() => import('./pages/public/ProductDetail'));
const Markets = lazy(() => import('./pages/public/Markets'));
const MarketDetail = lazy(() => import('./pages/public/MarketDetail'));
const Farmers = lazy(() => import('./pages/public/Farmers'));
const FarmerDetail = lazy(() => import('./pages/public/FarmerDetail'));
const MapExplore = lazy(() => import('./pages/public/MapExplore'));
const About = lazy(() => import('./pages/public/About'));
const Terms = lazy(() => import('./pages/public/Terms'));
const Faq = lazy(() => import('./pages/public/Faq'));
const Contact = lazy(() => import('./pages/public/Contact'));
const Unsubscribe = lazy(() => import('./pages/public/Unsubscribe'));
const Cart = lazy(() => import('./pages/public/Cart'));
const Checkout = lazy(() => import('./pages/public/Checkout'));
const CheckoutSuccess = lazy(() => import('./pages/public/CheckoutSuccess'));
const NotFound = lazy(() => import('./pages/public/NotFound'));

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const RegisterFarmer = lazy(() => import('./pages/auth/RegisterFarmer'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

const Notifications = lazy(() => import('./pages/customer/Notifications'));
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const CustomerOrders = lazy(() => import('./pages/customer/Orders'));
const OrderDetail = lazy(() => import('./pages/customer/OrderDetail'));
const Favorites = lazy(() => import('./pages/customer/Favorites'));
const Profile = lazy(() => import('./pages/customer/Profile'));

const FarmerDashboard = lazy(() => import('./pages/farmer/Dashboard'));
const FarmerOrders = lazy(() => import('./pages/farmer/Orders'));
const FarmerProducts = lazy(() => import('./pages/farmer/Products'));
const FarmerPickup = lazy(() => import('./pages/farmer/Pickup'));
const FarmerProfile = lazy(() => import('./pages/farmer/Profile'));
const FarmerInventory = lazy(() => import('./pages/farmer/Inventory'));
const FarmerSales = lazy(() => import('./pages/farmer/Sales'));
const MyReviews = lazy(() => import('./pages/customer/MyReviews'));
const FarmerReviews = lazy(() => import('./pages/farmer/Reviews'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminFarmers = lazy(() => import('./pages/admin/Farmers'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const AdminMarkets = lazy(() => import('./pages/admin/Markets'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'));
const AdminOfferBanner = lazy(() => import('./pages/admin/OfferBanner'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminMessages = lazy(() => import('./pages/admin/Messages'));
const AdminCities = lazy(() => import('./pages/admin/Cities'));
const AdminCustomerDetail = lazy(() => import('./pages/admin/CustomerDetail'));
const AdminPickupProblems = lazy(() => import('./pages/admin/PickupProblems'));
const AdminAttendance = lazy(() => import('./pages/admin/Attendance'));
const AdminPurchases = lazy(() => import('./pages/admin/Purchases'));
const AdminModeration = lazy(() => import('./pages/admin/Moderation'));
const AdminNewsletter = lazy(() => import('./pages/admin/Newsletter'));
const AdminFaqs = lazy(() => import('./pages/admin/Faqs'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="products" element={<Products />} />
            <Route path="best-sellers" element={<BestSellers />} />
            <Route path="credits" element={<PhotoCredits />} />
            <Route path="categories" element={<Categories />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="markets" element={<Markets />} />
            <Route path="markets/:slug" element={<MarketDetail />} />
            <Route path="farmers" element={<Farmers />} />
            <Route path="farmers/:slug" element={<FarmerDetail />} />
            <Route path="about" element={<About />} />
            <Route path="terms" element={<Terms />} />
            <Route path="faq" element={<Faq />} />
            <Route path="contact" element={<Contact />} />
            <Route path="unsubscribe" element={<Unsubscribe />} />
            <Route path="cart" element={<Cart />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="register/farmer" element={<RegisterFarmer />} />
            <Route path="admin/login" element={<Navigate to="/login" replace />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password/:token" element={<ResetPassword />} />
            <Route path="checkout" element={<Checkout />} />
            <Route element={<ProtectedRoute roles={['customer']} />}>
              <Route path="checkout/success" element={<CheckoutSuccess />} />
              <Route path="checkout/:numbers" element={<CheckoutSuccess />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="map" element={<PublicLayout footer={false} />}>
            <Route index element={<MapExplore />} />
          </Route>

          <Route path="account" element={<ProtectedRoute roles={['customer']} />}>
            <Route element={<DashboardLayout role="customer" />}>
              <Route index element={<CustomerDashboard />} />
              <Route path="orders" element={<CustomerOrders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="favorites" element={<Favorites />} />
              <Route path="reviews" element={<MyReviews />} />
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route path="farmer" element={<ProtectedRoute roles={['farmer']} />}>
            <Route element={<DashboardLayout role="farmer" />}>
              <Route index element={<FarmerDashboard />} />
              <Route path="profile" element={<FarmerProfile />} />
              <Route path="notifications" element={<Notifications />} />
              <Route element={<ApprovedFarmerRoute />}>
                <Route path="orders" element={<FarmerOrders />} />
                <Route path="orders/:id" element={<OrderDetail />} />
                <Route path="products" element={<FarmerProducts />} />
                <Route path="inventory" element={<FarmerInventory />} />
                <Route path="pickup" element={<FarmerPickup />} />
                <Route path="reviews" element={<FarmerReviews />} />
                <Route path="sales" element={<FarmerSales />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route path="admin" element={<ProtectedRoute roles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="pickup-problems" element={<AdminPickupProblems />} />
              <Route path="attendance" element={<AdminAttendance />} />
              <Route path="farmers" element={<AdminFarmers />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="customers/:id" element={<AdminCustomerDetail />} />
              <Route path="markets" element={<AdminMarkets />} />
              <Route path="cities" element={<AdminCities />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="moderation" element={<AdminModeration />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="offer-banner" element={<AdminOfferBanner />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="newsletter" element={<AdminNewsletter />} />
              <Route path="faqs" element={<AdminFaqs />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="purchases" element={<AdminPurchases />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
